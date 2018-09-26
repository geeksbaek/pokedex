// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
"use strict";

const functions = require("firebase-functions");
const Josa = require("josa-js");
const fs = require("fs");
const { WebhookClient, Image, Suggestion } = require("dialogflow-fulfillment");

process.env.DEBUG = "dialogflow:*"; // enables lib debugging statements
const pokedex = JSON.parse(fs.readFileSync("data.json", "utf8"));

exports.dialogflowFirebaseFulfillment = functions.https.onRequest(
  (request, response) => {
    const agent = new WebhookClient({ request, response });
    console.log(
      "Dialogflow Request headers: " + JSON.stringify(request.headers)
    );
    console.log("Dialogflow Request body: " + JSON.stringify(request.body));

    // 포켓몬 묻기
    function questionAboutPokemonHandler(agent) {
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

      const pokemonName =
        pokemonSimple ||
        `${pokemonComposite["pokemon-form-type-list"]} 폼 ${
          pokemonComposite["pokemon-list"]
        }`;

      if (!find) {
        if (pokemonSimple || pokemonComposite) {
          agent.add(`${pokemonName}라는 포켓몬은 없는 듯 하다...`);
        } else {
          agent.add(`그런 이름의 포켓몬은 없는 듯 하다...`);
        }
        return;
      }

      if (find.classify) {
        agent.add(`${pokemonName}. ${find.classify}.\n${find.info}`);
      } else {
        agent.add(`${pokemonName}.\n${find.info}`);
      }

      agent.add(new Image(find.image_url));

      let advice = [];

      let strength = find.cp_rank / pokedex.length;
      if (strength < 0.1) {
        advice.push(`이 포켓몬은 매우 강한 것 같다!`);
      } else if (strength < 0.2) {
        advice.push(`이 포켓몬은 꽤 강한 것 같다!`);
      } else if (strength < 0.3) {
        advice.push(`이 포켓몬의 강함은 보통인 것 같다.`);
      } else if (strength < 0.6) {
        advice.push(`이 포켓몬은 그다지 강한 것 같지 않다.`);
      } else {
        advice.push(`이 포켓몬은 싸움과는 거리가 먼 것 같다.`);
      }

      if (find.base_capture_rate >= 0.4) {
        advice.push(`포획 난이도는 쉬운 편이다.`);
      } else if (find.base_capture_rate >= 0.2) {
        advice.push(`포획 난이도는 보통인 편이다.`);
      } else if (find.base_capture_rate >= 0.1) {
        advice.push(`포획 난이도는 어려운 편이다.`);
      } else if (find.base_capture_rate == 0) {
        advice.push(`이 포켓몬은 야생에서 만날 수 없는 것 같다.`);
      } else {
        advice.push(`포획 난이도는 매우 어려운 편이므로 주의할 것!`);
      }

      advice.push(`${find.types.join(", ")} 타입을 가지고 있다.`);
      agent.add(advice.join("\n"));

      // agent.add(
      //   new Card({
      //     title: pokemonName,
      //     imageUrl: find.image_url,
      //     buttonText: "pokemon.gameinfo.io 에서 자세히 보기",
      //     buttonUrl: `https://pokemon.gameinfo.io/ko/pokemon/${
      //       find.number
      //     }/${formToParam(find.form)}`
      //   })
      // );

      find.evolution.forEach(name => {
        agent.add(new Suggestion(name));
      });
      // agent.add(new Suggestion(`${pokemonName}의 타입`));
      agent.add(new Suggestion(`${pokemonName}의 카운터 포켓몬`));
      agent.add(new Suggestion(`알았어`));
    }

    // 둥지 묻기
    function tellNestHandler(agent) {}

    // 포켓몬의 카운터 묻기
    function questionCounterOfPokemonHandler(agent) {
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

      const pokemonName =
        pokemonSimple ||
        `${pokemonComposite["pokemon-form-type-list"]} 폼 ${
          pokemonComposite["pokemon-list"]
        }`;

      if (!find) {
        if (pokemonSimple || pokemonComposite) {
          agent.add(`${pokemonName}라는 포켓몬은 없는 듯 하다...`);
        } else {
          agent.add(`그런 이름의 포켓몬은 없는 듯 하다...`);
        }
        return;
      }

      const result = sort(find.counters);

      agent.add(
        `${Josa.r(pokemonName, "은/는")} ${find.types.join(
          ", "
        )} 타입 포켓몬이며, ${find.weaknesses_types.join(
          ", "
        )} 타입의 공격에 특히 취약하다.`
      );

      agent.add(new Image(find.image_url));

      agent.add(
        `${pokemonName}에게 가장 강한 포켓몬은 ${
          result[0].quick_skill
        }, ${Josa.r(result[0].charge_skill, "을/를")} 사용하는 ${
          result[0].name
        }이다.`
      );
      agent.add(new Suggestion(`${result[0].name}`));
      agent.add(new Suggestion(`알았어`));
    }

    // 타입의 포켓몬 묻기
    function questionPokemonOfTypeHandler(agent) {
      const types = agent.parameters["pokemon-type-list"];

      if (types.length > 2) {
        agent.add(
          `현재까지 발견된 포켓몬은 많아도 2개의 타입밖에 가질 수 없다.`
        );
        return;
      }

      let selected = pokedex.filter(
        v => types.filter(t => v.types.includes(t)).length == types.length
      );

      if (selected.length == 0) {
        agent.add(`${types.join(", ")} 타입을 가지는 포켓몬은 없는 듯 하다...`);
        return;
      }
      selected = sort(selected);

      agent.add(
        `${types.join(", ")} 타입을 가지는 ${
          selected.length
        }마리의 포켓몬이 존재한다.`
      );
      agent.add(
        `${selected
          .slice(0, selected.length >= 5 ? 5 : selected.length)
          .map(v => v.name)
          .join(", ")}...`
      );

      selected.forEach(v => {
        agent.add(new Suggestion(v.name));
      });
      agent.add(new Suggestion(`알았어`));
    }

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

      // let list = new List({
      //   title: "포켓몬 도감 검색 결과"
      // });

      pokemonSimpleList.forEach(pokemon => {
        // let find = simpleResult.find(v => v.name == pokemon);

        // list[pokemon] = {
        //   title: pokemon,
        //   description: `${find.types.join(", ")}  타입의 포켓몬이다.`,
        //   image: new Image({
        //     url: find.image_url,
        //     alt: pokemon
        //   })
        // };
        agent.add(
          `${pokemon}. ${simpleResult
            .find(v => v.name == pokemon)
            .types.join(", ")} 타입의 포켓몬이다.`
        );
      });

      pokemonCompositeList.forEach(pokemon => {
        // let find = compositeResult.find(
        //   v =>
        //     v.name == pokemon["pokemon-list"] &&
        //     v.form == pokemon["pokemon-form-type-list"]
        // );
        // let name = `${pokemon["pokemon-form-type-list"]} 폼 ${
        //   pokemon["pokemon-list"]
        // }`;

        // list[name] = {
        //   title: name,
        //   description: `${find.types.join(", ")}  타입의 포켓몬이다.`,
        //   image: new Image({
        //     url: find.image_url,
        //     alt: name
        //   })
        // };
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
      });

      // agent.add(list);

      pokemonSimpleList.forEach(pokemon => {
        agent.add(new Suggestion(`${pokemon}의 카운터 포켓몬`));
      });

      pokemonCompositeList.forEach(pokemon => {
        agent.add(
          new Suggestion(
            `${pokemon["pokemon-form-type-list"]} 폼 ${
              pokemon["pokemon-list"]
            }의 카운터 포켓몬`
          )
        );
      });
    }

    // Run the proper function handler based on the matched Dialogflow intent name
    let intentMap = new Map();
    intentMap.set("tell_nest", tellNestHandler);
    intentMap.set("포켓몬_묻기", questionAboutPokemonHandler);
    intentMap.set("포켓몬의_카운터_묻기", questionCounterOfPokemonHandler);
    intentMap.set("타입의_포켓몬_묻기", questionPokemonOfTypeHandler);
    intentMap.set("포켓몬의_타입_묻기", questionTypeOfPokemonHandler);
    agent.handleRequest(intentMap);
  }
);

function sort(pokemons) {
  return pokemons.sort((a, b) => {
    let pokemonA = pokedex.find(v => v.name == a.name);
    let pokemonB = pokedex.find(v => v.name == b.name);
    if (b.percentage != undefined && a.percentage != undefined) {
      return b.percentage * pokemonB.max_cp - a.percentage * pokemonA.max_cp;
    }
    return pokemonB.max_cp - pokemonA.max_cp;
  });
}
