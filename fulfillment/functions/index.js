// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
"use strict";

const functions = require("firebase-functions");
const fetch = require("node-fetch");
const Josa = require("josa-js");
const fs = require("fs");
const {
  WebhookClient,
  Card,
  Image,
  Suggestion
} = require("dialogflow-fulfillment");

process.env.DEBUG = "dialogflow:*"; // enables lib debugging statements
const pokedex = JSON.parse(fs.readFileSync("data/pokemon.json", "utf8")).concat(
  JSON.parse(fs.readFileSync("data/custom_pokemon.json", "utf8"))
);
const mythical = JSON.parse(fs.readFileSync("data/mythical.json", "utf8"));
const legendary = JSON.parse(fs.readFileSync("data/legendary.json", "utf8"));
const regional = JSON.parse(fs.readFileSync("data/regional.json", "utf8"));

exports.dialogflowFirebaseFulfillment = functions.https.onRequest(
  (request, response) => {
    const agent = new WebhookClient({ request, response });
    console.log(
      "Dialogflow Request headers: " + JSON.stringify(request.headers)
    );
    console.log("Dialogflow Request body: " + JSON.stringify(request.body));

    function mainHandler(agent) {
      let message = [];
      message.push(`안녕하세요. 포켓몬 도감입니다.`);
      message.push(`궁금하신 포켓몬의 이름을 말씀해 주세요.`);

      agent.add(message.join("\n"));

      agent.add(
        new Card({
          title: `아직 포켓몬 트레이너가 아니신가요?`,
          imageUrl: "https://i.imgur.com/psJq1KD.jpg",
          text: [
            `Pokémon GO는 당신이 사는 세계 모두가 무대입니다.`,
            `평상시 생활에서 포켓몬을 잡거나 배틀하거나 포켓몬 트레이너로서의 일상이 시작됩니다!`,
            `이 게임은 모니터 안에서 끝나지 않습니다. 여러분은 포켓몬 트레이너로서 집 밖으로 나와 포켓몬을 찾으면서 즐길 수 있습니다.`
          ].join(`  \n`),
          buttonText: `Google Play Store에서 다운로드`,
          buttonUrl: `https://play.google.com/store/apps/details?id=com.nianticlabs.pokemongo`
        })
      );

      agent.add(new Suggestion("피카츄 알아?"));
      agent.add(new Suggestion("해피너스 상성 알려줘"));
      agent.add(new Suggestion("143번 포켓몬이 뭐지?"));
      agent.add(new Suggestion("지금 이벤트 뭐 해?"));
    }

    function fallbackHandler(agent) {
      agent.add(`포켓몬 이름을 말씀해 주세요.`);

      agent.add(
        new Card({
          title: `더 많은 정보를 원하시나요?`,
          text: `Pokémon GO 공식 홈페이지에서 더 많은 정보를 얻을 수 있습니다.`,
          buttonText: `Pokémon GO Support`,
          buttonUrl: `https://support.pokemongo.nianticlabs.com/hc/ko`
        })
      );
    }

    // 포켓몬 묻기
    function questionAboutPokemonHandler(agent) {
      const find = search(agent);

      if (!find.pokemon) {
        agent.add(`그런 이름의 포켓몬은 없는 듯 하다...`);
        return;
      }

      let advice = [];
      advice.push(`${find.name}. ${find.pokemon.types.join("·")} 타입 포켓몬.`);

      let tier = calcCPTier(find.pokemon.max_cp);

      advice.push(`최대 CP ${find.pokemon.max_cp}의 ${tier}등급 포켓몬이다.`);

      if (find.pokemon.base_capture_rate >= 0.4) {
        advice.push(`포획 난이도는 쉬운 편이다.`);
      } else if (find.pokemon.base_capture_rate >= 0.2) {
        advice.push(`포획 난이도는 보통인 편이다.`);
      } else if (find.pokemon.base_capture_rate >= 0.1) {
        advice.push(`포획 난이도는 어려운 편이다.`);
      } else if (find.pokemon.base_capture_rate >= 0.05) {
        advice.push(`포획 난이도는 아주 어려운 편이다.`);
      } else if (find.pokemon.base_capture_rate == 0) {
        // advice.push(`이 포켓몬은 야생에서 만날 수 없는 것 같다.`);
      } else {
        advice.push(`포획 난이도는 아주 아주 어려운 편이다.`);
      }

      let addedText = "";

      if (find.pokemon.quick.length > 0) {
        addedText += `  \n  \n빠른 공격  \n`;
        addedText += find.pokemon.quick
          .sort(
            (a, b) =>
              (b.stab ? b.dps * 1.25 : b.dps) - (a.stab ? a.dps * 1.25 : a.dps)
          )
          .map(v => {
            let name = v.event ? `${v.name}(이벤트)` : v.name;
            return v.stab ? `**${name}**` : name;
          })
          .join(" · ");
      }

      if (find.pokemon.charge.length > 0) {
        addedText += `  \n  \n주요 공격  \n`;
        addedText += find.pokemon.charge
          .sort(
            (a, b) =>
              (b.stab ? b.dps * 1.25 : b.dps) - (a.stab ? a.dps * 1.25 : a.dps)
          )
          .map(v => {
            let name = v.event ? `${v.name}(이벤트)` : v.name;
            return v.stab ? `**${name}**` : name;
          })
          .join(" · ");
      }

      if (mythical[find.pokemon.name]) {
        addedText += `  \n  \n*${mythical[find.pokemon.name].note}*`;
      } else if (legendary[find.pokemon.name]) {
        addedText += `  \n  \n*${legendary[find.pokemon.name].note}*`;
      } else if (regional[find.pokemon.name]) {
        addedText += `  \n  \n*${regional[find.pokemon.name].note}*`;
      }

      agent.add(advice.join("\n"));

      let card = new Card({
        title: find.formattedName
      });

      if (find.pokemon.image_url) {
        card.setImage(find.pokemon.image_url);
      }

      card.setText(
        `${find.pokemon.classify}  \n${
          find.pokemon.classify ? find.pokemon.info : ""
        }${addedText}`
      );

      if (find.pokemon.url) {
        card.setButton({
          text: "자세한 정보 확인하기",
          url: find.pokemon.url
        });
      } else if (regional[find.pokemon.name]) {
        card.setButton({
          text: "출현 지역 확인하기",
          url: regional[find.pokemon.name].image_url
        });
      }

      agent.add(card);

      agent.add(new Suggestion(`${find.name}의 카운터 포켓몬`));
      find.pokemon.evolution.forEach(name => {
        pokedex
          .filter(v => v.name == name)
          .forEach(v => {
            if (v.form == "캐스퐁") {
              agent.add(new Suggestion(name));
            } else {
              agent.add(new Suggestion(`${v.form} 폼 ${name}`));
            }
          });
      });

      agent.add(new Suggestion(`${find.pokemon.types.join(", ")} 타입 포켓몬`));
      if (mythical[find.pokemon.name]) {
        agent.add(new Suggestion(`환상의 포켓몬`));
      } else if (legendary[find.pokemon.name]) {
        agent.add(new Suggestion(`전설의 포켓몬`));
      } else if (regional[find.pokemon.name]) {
        agent.add(new Suggestion(`지역 한정 포켓몬`));
      }
      agent.add(new Suggestion(`닫기`));
    }

    function questionMythical(agent) {
      agent.add(
        `환상의 포켓몬.\n특별한 리서치를 통해서만 만날 수 있는 포켓몬이다.`
      );

      let pokemons = Object.keys(mythical)
        .map(v => `**${v}**`)
        .join(", ");

      agent.add(
        new Card({
          title: `환상의 포켓몬`,
          imageUrl: shuffle([
            `https://i.imgur.com/OJoEy6k.png`,
            `https://i.imgur.com/6cAT9bu.jpg`
          ])[0],
          text: `현재까지 알려진 환상의 포켓몬은 ${pokemons}가 있다.`
        })
      );

      Object.keys(mythical).forEach(pokemon => {
        agent.add(new Suggestion(pokemon));
      });
      agent.add(new Suggestion(`닫기`));
    }

    function questionLegendary(agent) {
      agent.add(
        `전설의 포켓몬.\n특별한 리서치나 전설 레이드배틀을 통해서만 만날 수 있는 포켓몬이다.`
      );

      let pokemons = Object.keys(legendary)
        .map(v => `**${v}**`)
        .join(", ");

      agent.add(
        new Card({
          title: `전설의 포켓몬`,
          imageUrl: shuffle([
            `https://i.imgur.com/g6sreeA.jpg`,
            `https://i.imgur.com/1kMH95e.jpg`,
            `https://i.imgur.com/pBMUF8B.jpg`
          ])[0],
          text: `현재까지 알려진 전설의 포켓몬은 ${pokemons}가 있다.`
        })
      );

      Object.keys(legendary).forEach(pokemon => {
        agent.add(new Suggestion(pokemon));
      });
      agent.add(new Suggestion(`닫기`));
    }

    function questionRegional(agent) {
      agent.add(`지역 한정 포켓몬.\n일부 지역에서만 만날 수 있는 포켓몬이다.`);

      let pokemons = Object.keys(regional)
        .map(v => `**${v}**`)
        .join(", ");

      agent.add(
        new Card({
          title: `지역 한정 포켓몬`,
          imageUrl: `https://i.imgur.com/Z2JGnBj.jpg`,
          text: `현재까지 알려진 지역 한정 포켓몬은 ${pokemons}가 있다.`
        })
      );

      Object.keys(regional).forEach(pokemon => {
        agent.add(new Suggestion(pokemon));
      });
      agent.add(new Suggestion(`닫기`));
    }

    // 둥지 묻기
    function tellNestHandler(agent) {}

    // 포켓몬의 카운터 묻기
    function questionCounterOfPokemonHandler(agent) {
      const find = search(agent);

      if (!find.pokemon) {
        agent.add(`그런 이름의 포켓몬은 없는 듯 하다...`);
        return;
      }

      const result = removeDups(sort(find.pokemon.counters));

      agent.add(
        `${Josa.r(find.name, "은/는")} ${find.pokemon.types.join(
          "·"
        )} 타입 포켓몬이며, ${find.pokemon.weaknesses_types.join(
          "·"
        )} 타입 공격에 특히 취약하다.`
      );

      let advice = [];
      let weaknessesName = [];

      result.forEach(v => {
        let name = v.form == "캐스퐁" ? v.name : `${v.form} 폼 ${v.name}`;
        let tier = calcCPTier(
          pokedex.find(vv => vv.name == v.name && vv.form == v.form).max_cp
        );

        advice.push(`**${name}** (${tier}등급)  \n${v.quick} · ${v.charge}`);
        weaknessesName.push(name);
      });

      let card = new Card({
        title: `${find.name}에게 큰 피해를 주는 포켓몬`,
        text: `${advice.length > 0 ? advice.join("  \n  \n") : "???"}`
      });
      // if (find.pokemon.image_url) {
      //   card.setImage(find.pokemon.image_url);
      // }
      agent.add(card);

      weaknessesName.forEach(name => {
        agent.add(new Suggestion(`${name}`));
      });
      agent.add(new Suggestion(`${find.pokemon.types.join(", ")} 타입 포켓몬`));
      agent.add(
        new Suggestion(
          `${find.pokemon.weaknesses_types.join(", ")} 타입 포켓몬`
        )
      );
      agent.add(new Suggestion(`닫기`));
    }

    // 타입의 포켓몬 묻기
    function questionPokemonOfTypeHandler(agent) {
      const types = agent.parameters["pokemon-type-list"];

      if (types.length > 2) {
        agent.add(
          `현재까지 발견된 포켓몬은 많아도 2개의 타입밖에 가질 수 없다.`
        );
        types.forEach(v => {
          agent.add(new Suggestion(`${v} 타입 포켓몬`));
        });
        return;
      }

      let selected = pokedex.filter(
        v => types.filter(t => v.types.includes(t)).length == types.length
      );

      if (selected.length == 0) {
        agent.add(`${types.join("·")} 타입을 가지는 포켓몬은 없는 듯 하다...`);
        types.forEach(v => {
          agent.add(new Suggestion(`${v} 타입 포켓몬`));
        });
        return;
      }
      selected = sort(selected);

      agent.add(
        `${types.join("·")} 타입을 가지는 포켓몬은 ${selected
          .filter((v, i) => i < 5)
          .map(v => (v.form == "캐스퐁" ? v.name : `${v.form} 폼 ${v.name}`))
          .join(", ")} 등 ${selected.length}마리의 포켓몬이 있다.`
      );

      selected
        .filter((v, i) => i < 5)
        .forEach(v => {
          agent.add(
            new Suggestion(
              v.form == "캐스퐁" ? v.name : `${v.form} 폼 ${v.name}`
            )
          );
        });
      agent.add(new Suggestion(`닫기`));
    }

    // TODO.
    // 복수의 타입을 묻지 못하도록 변경해야 함
    // 포켓몬의 타입 묻기
    function questionTypeOfPokemonHandler(agent) {
      const pokemonSimpleList = agent.parameters["pokemon-list"];
      const pokemonCompositeList = agent.parameters["pokemon-composite-list"];

      const simpleResult = pokedex.filter(v1 =>
        pokemonSimpleList.find(v2 => v1.name == v2 && v1.form == "캐스퐁")
      );
      const compositeResult = pokedex.filter(v1 =>
        pokemonCompositeList.find(
          v2 =>
            v1.name == v2["pokemon-list"] &&
            v1.form == v2["pokemon-form-type-list"]
        )
      );

      if (simpleResult.length == 0 && compositeResult.length == 0) {
        agent.add(`포켓몬 도감에 정보가 없는 듯 하다.`);
        return;
      }

      pokemonSimpleList.forEach(pokemon => {
        agent.add(
          `${pokemon}. ${simpleResult
            .find(v => v.name == pokemon)
            .types.join(", ")} 타입의 포켓몬이다.`
        );
        agent.add(new Suggestion(`${pokemon}의 카운터 포켓몬`));
      });

      pokemonCompositeList.forEach(pokemon => {
        agent.add(
          `${pokemon["pokemon-form-type-list"]} 폼 ${
            pokemon["pokemon-list"]
          }. ${compositeResult
            .find(
              v =>
                v.name == pokemon["pokemon-list"] &&
                v.form == pokemon["pokemon-form-type-list"]
            )
            .types.join(", ")} 타입의 포켓몬이다.`
        );
        agent.add(
          new Suggestion(
            `${pokemon["pokemon-form-type-list"]} 폼 ${
              pokemon["pokemon-list"]
            }의 카운터 포켓몬`
          )
        );
      });
    }

    async function questionEvent(agent) {
      let response = await fetch("http://104.196.148.238/posts");
      let data = await response.json();

      agent.add(`3개의 이벤트가 열리고 있습니다.`);
      agent.add(
        new Card({
          title: data[0].title,
          buttonText: "이벤트 자세히 보기",
          buttonUrl: data[0].url
        })
      );
      agent.add(
        new Card({
          title: data[1].title,
          buttonText: "이벤트 자세히 보기",
          buttonUrl: data[1].url
        })
      );
      agent.add(
        new Card({
          title: data[2].title,
          buttonText: "이벤트 자세히 보기",
          buttonUrl: data[2].url
        })
      );
    }

    function questionTier(agent) {
      const targetTier = agent.parameters["pokemon-tier-list"];

      let nameList = pokedex
        .filter(v => calcCPTier(v.max_cp) == targetTier)
        .sort((a, b) => b.max_cp - a.max_cp)
        .map(v => (v.form == "캐스퐁" ? v.name : `${v.form} 폼 ${v.name}`));

      let subNameList = nameList.filter((v, i) => i < 20);
      agent.add(
        `${targetTier}등급 포켓몬은 ${subNameList.join(", ")} 등 총 ${
          nameList.length
        }마리가 있다.`
      );

      subNameList.forEach(name => {
        agent.add(new Suggestion(name));
      });
      agent.add(new Suggestion(`닫기`));
    }

    // Run the proper function handler based on the matched Dialogflow intent name
    let intentMap = new Map();
    intentMap.set("tell_nest", tellNestHandler);
    intentMap.set("Default Welcome Intent", mainHandler);
    intentMap.set("Default Fallback Intent", fallbackHandler);
    intentMap.set("포켓몬_묻기", questionAboutPokemonHandler);
    intentMap.set("포켓몬의_카운터_묻기", questionCounterOfPokemonHandler);
    intentMap.set("타입의_포켓몬_묻기", questionPokemonOfTypeHandler);
    intentMap.set("포켓몬의_타입_묻기", questionTypeOfPokemonHandler);
    intentMap.set("환상의_포켓몬_묻기", questionMythical);
    intentMap.set("전설의_포켓몬_묻기", questionLegendary);
    intentMap.set("지역_한정_포켓몬_묻기", questionRegional);
    intentMap.set("등급의_포켓몬_묻기", questionTier);
    intentMap.set("이벤트_묻기", questionEvent);
    agent.handleRequest(intentMap);
  }
);

function search(agent) {
  const pokemonSimple = agent.parameters["pokemon-list"];
  const pokemonComposite = agent.parameters["pokemon-composite-list"];
  const find = pokedex.find(v => {
    if (pokemonSimple) {
      return v.name == pokemonSimple && v.form == "캐스퐁";
    } else if (pokemonComposite) {
      return (
        v.name == pokemonComposite["pokemon-list"] &&
        v.form == pokemonComposite["pokemon-form-type-list"]
      );
    }
  });

  const formattedNumber = find
    ? find.number.toString().padStart(3, "0")
    : "???";

  return {
    pokemon: find,
    name:
      pokemonSimple ||
      `${pokemonComposite["pokemon-form-type-list"]} 폼 ${
        pokemonComposite["pokemon-list"]
      }`,
    formattedName: pokemonSimple
      ? `${pokemonSimple}  #${formattedNumber}`
      : `${pokemonComposite["pokemon-list"]} #${formattedNumber} (${
          pokemonComposite["pokemon-form-type-list"]
        }의 모습)`
  };
}

function sort(pokemons) {
  return pokemons.sort((a, b) => {
    let pokemonA = pokedex.find(v => v.name == a.name);
    let pokemonB = pokedex.find(v => v.name == b.name);
    if (b.percentage != undefined && a.percentage != undefined) {
      return b.percentage - a.percentage;
    }
    return pokemonB.max_cp - pokemonA.max_cp;
  });
}

function removeDups(pokemons) {
  let ret = [];
  pokemons.forEach(v1 => {
    if (ret.find(v2 => v2.name == v1.name && v2.form == v1.form)) {
      return;
    }
    ret.push(v1);
  });
  return ret;
}

function calcCPTier(cp) {
  return ["S", "A", "B", "C", "D", "E", "F"][
    cp / 500 >= 6 ? 0 : 6 - parseInt(cp / 500)
  ];
}

function josa_ro(num) {
  switch (num % 10) {
    case 3:
    case 6:
    case 0:
      return `${num}으로`;
  }
  return `${num}로`;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}