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
        advice.push(`이 포켓몬의 최대 CP는 ${find.max_cp}! 매우 강한 것 같다!`);
      } else if (strength < 0.2) {
        advice.push(`이 포켓몬의 최대 CP는 ${find.max_cp}! 꽤 강한 것 같다.`);
      } else if (strength < 0.3) {
        advice.push(`이 포켓몬의 최대 CP는 ${find.max_cp}. 보통인 것 같다.`);
      } else if (strength < 0.6) {
        advice.push(
          `이 포켓몬의 최대 CP는 ${find.max_cp}. 그다지 강해 보이지 않는다.`
        );
      } else {
        advice.push(
          `이 포켓몬의 최대 CP는 ${find.max_cp}. 싸움과는 거리가 먼 것 같다.`
        );
      }

      if (find.base_capture_rate >= 0.4) {
        advice.push(`포획 난이도는 쉬운 편.`);
      } else if (find.base_capture_rate >= 0.2) {
        advice.push(`포획 난이도는 보통인 편.`);
      } else if (find.base_capture_rate >= 0.1) {
        advice.push(`포획 난이도는 어려운 편.`);
      } else if (find.base_capture_rate == 0) {
        advice.push(`이 포켓몬은 진화를 통해서만 얻을 수 있는 것 같다.`);
      } else {
        advice.push(`포획 난이도는 매우 어려운 편.`);
      }

      advice.push(`${find.types.join(", ")} 타입 포켓몬이다.`);
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
      // find.types.forEach(t => {
      //   agent.add(new Suggestion(`${t} 타입 포켓몬`));
      // });
      agent.add(new Suggestion(`${find.types.join(", ")} 타입 포켓몬`));
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

      const result = removeDups(sort(find.counters));

      agent.add(
        `${Josa.r(pokemonName, "은/는")} ${find.types.join(
          ", "
        )} 타입 포켓몬이며, ${find.weaknesses_types.join(
          ", "
        )} 타입의 공격에 특히 취약하다.`
      );

      agent.add(new Image(find.image_url));

      let advice = [];
      let weaknessesName = [];

      result.filter((v, i) => i < 3).forEach(v => {
        let name = v.form == "캐스퐁" ? v.name : `${v.form} 폼 ${v.name}`;
        advice.push(
          `${v.quick_skill}·${Josa.r(v.charge_skill, "을/를")} 사용하는 ${name}`
        );
        weaknessesName.push(name);
      });

      agent.add(
        `${pokemonName}의 카운터 포켓몬은 ${advice.join(", ")} 등이 있다.`
      );

      weaknessesName.forEach(name => {
        agent.add(new Suggestion(`${name}`));
      });
      agent.add(new Suggestion(`${find.types.join(", ")} 타입 포켓몬`));
      agent.add(
        new Suggestion(`${find.weaknesses_types.join(", ")} 타입 포켓몬`)
      );
      agent.add(new Suggestion(`알았어`));
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
        agent.add(`${types.join(", ")} 타입을 가지는 포켓몬은 없는 듯 하다...`);
        types.forEach(v => {
          agent.add(new Suggestion(`${v} 타입 포켓몬`));
        });
        return;
      }
      selected = sort(selected);

      agent.add(
        `${types.join(", ")} 타입을 가지는 포켓몬은 ${selected
          .filter((v, i) => i < 5)
          .map(v => v.name)
          .join(", ")} 등 ${selected.length}마리의 포켓몬이 있다.`
      );

      selected.filter((v, i) => i < 5).forEach(v => {
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
