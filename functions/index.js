"use strict";

const {
  dialogflow,
  BasicCard,
  BrowseCarousel,
  Permission,
  Button,
  List,
  Image,
  Suggestions
} = require("actions-on-google");

const stringSimilarity = require("string-similarity");
const Josa = require("josa-js");

const functions = require("firebase-functions");
const fs = require("fs");

const app = dialogflow({ debug: true });

// DB로 사용할 JSON 파일 읽기
const pokedex = JSON.parse(fs.readFileSync("data/ko/pokemon.min.json", "utf8"));
const pokedexEn = JSON.parse(
  fs.readFileSync("data/en/pokemon.min.json", "utf8")
);
const mythical = JSON.parse(fs.readFileSync("data/mythical.json", "utf8"));
const legendary = JSON.parse(fs.readFileSync("data/legendary.json", "utf8"));
const regional = JSON.parse(fs.readFileSync("data/regional.json", "utf8"));

const reNameForm = /([^ ]+) \((.*)\)/;

app.intent("Default Welcome Intent", conv => {
  conv.ask("안녕하세요. 포켓몬 도감입니다. 궁금한 것을 물어보세요.");
  conv.ask(
    new Suggestions([
      "파치리스 알려줘",
      "레쿠쟈 약점이 뭐야?",
      "근처에 무슨 둥지 있어?",
      "무슨 이벤트 해?"
    ])
  );
  conv.ask(new Suggestions(`❌ 닫기`));
});

app.intent("포켓몬 검색", (conv, _, option) => {
  if (!conv.parameters["name"]) {
    const text = option || conv.arguments.parsed.input.text;
    const match = text.match(reNameForm);
    if (match) {
      conv.parameters["name"] = match[1];
      conv.parameters["form"] = match[2];
    } else {
      conv.parameters["name"] = text;
    }
  }

  // name과 가장 비슷한 이름을 가진 포켓몬을 찾는다.
  const pokemons = findMostSimilarPokemons(
    conv.parameters["name"],
    conv.parameters["form"]
  );
  const name = pokemons[0].name;

  // 검색 결과가 하나인 경우 하나의 포켓몬을 BasicCard 로 응답한다.
  if (pokemons.length === 1) {
    conv.ask(
      `<speak>` +
        `${name}.<break time="300ms"/>` +
        `${pokemons[0].classify}.  \n<break time="300ms"/>` +
        `${pokemons[0].info}` +
        `</speak>`
    );
    conv.ask(buildPokemonCard(pokemons[0]));
    conv.ask(buildSuggestions(pokemons[0]));
    return;
  }

  // 검색 결과가 여러 개인 경우 포켓몬의 목록을 List 로 응답한다.
  conv.ask(
    `여러 폼 타입의 ${Josa.r(name, "이/가")} 있다. ` +
      `궁금한 포켓몬을 선택하시오.`
  );
  conv.ask(buildPokemonList(pokemons));
  conv.ask(new Suggestions(`❌ 닫기`));
});

app.intent("포켓몬 약점", (conv, _, option) => {
  if (!conv.parameters["name"]) {
    const text = option || conv.arguments.parsed.input.text;
    const match = text.match(reNameForm);
    if (match) {
      conv.parameters["name"] = match[1];
      conv.parameters["form"] = match[2];
    } else {
      conv.parameters["name"] = text;
    }
  }

  const pokemons = findMostSimilarPokemons(
    conv.parameters["name"],
    conv.parameters["form"]
  );

  const name = pokemons[0].name;

  if (pokemons.length === 1) {
    pokemons[0].has_multi_form_type
      ? conv.ask(
          `${name} (${pokemons[0].form})에게 ` +
            `가장 큰 피해를 입히는 포켓몬의 목록입니다.`
        )
      : conv.ask(`${name}에게 가장 큰 피해를 입히는 포켓몬의 목록입니다.`);
    conv.ask(buildCounterList(pokemons[0]));
    conv.ask(new Suggestions(`❌ 닫기`));
    return;
  }

  conv.ask(
    `여러 타입의 ${Josa.r(name, "이/가")} 있습니다. ` +
      `약점이 궁금한 포켓몬을 선택해주세요.`
  );

  conv.ask(buildPokemonCounterList(pokemons));
  conv.ask(new Suggestions(`❌ 닫기`));
});

app.intent("타입 검색", conv => {
  const types = conv.parameters["pokemon-type-list"];

  if (types.length > 2) {
    conv.ask(`포켓몬은 최대 2개의 타입밖에 가질 수 없습니다.`);
    conv.ask(new Suggestions(types.map(el => `${el} 타입 포켓몬`)));
    return;
  }

  let find = pokedex
    .filter(el => types.every(type => el.types.includes(type)))
    .sort(sortStrong);

  if (find.length == 0) {
    conv.ask(`${types.join(" · ")} 타입을 가지는 포켓몬이 없습니다.`);
    conv.ask(new Suggestions(types.map(el => `${el} 타입 포켓몬`)));
    return;
  } else if (find.length === 1) {
    conv.ask(`${types.join(" · ")} 타입을 가지는 포켓몬을 찾았습니다.`);
    conv.ask(buildPokemonCard(find[0]));
    conv.ask(new Suggestions(`❌ 닫기`));
    return;
  }

  conv.ask(
    `${types.join(
      " · "
    )} 타입을 가지는 포켓몬을 찾았습니다. 궁금한 포켓몬을 선택해주세요.`
  );
  conv.ask(buildPokemonList(find));
  if (types.length >= 2) {
    conv.ask(new Suggestions(types.map(el => `${el} 타입 포켓몬`)));
  }
  conv.ask(new Suggestions(`❌ 닫기`));
});

const findPokemon = name => pokedex.filter(el => el.name === name);

const findPokemonWithForm = (name, form) =>
  pokedex.find(el => el.name === name && el.form === form);

const findMostSimilarPokemons = (name, form) => {
  const pokemon = stringSimilarity.findBestMatch(
    name,
    pokedex.map(el => el.name)
  ).bestMatch.target;

  if (form) {
    return [findPokemonWithForm(pokemon, form)];
  }
  return findPokemon(pokemon);
};

const buildPokemonCard = pokemonObj => {
  let regionalText = "";
  if (regional[pokemonObj.number]) {
    regionalText = `  \n  \n📍  \n지역 한정: ${
      regional[pokemonObj.number].where
    }`;
  }

  return new BasicCard({
    text:
      `💥  \n빠른 공격: ${pokemonObj.quick
        .sort(sortDPSWithStab)
        .map(buildChargeText)
        .join(" · ")}  \n` +
      `주요 공격: ${pokemonObj.charge
        .sort(sortDPSWithStab)
        .map(buildChargeText)
        .join(" · ")}  \n  \n` +
      `💫  \n최대 약점: ${buildFullWeaknesses(pokemonObj)}` +
      regionalText,
    title: `${buildFullName(pokemonObj)} #${("000" + pokemonObj.number).slice(
      -3
    )}`,
    subtitle: buildFullType(pokemonObj),
    buttons: new Button({
      title: "더 자세히 보기",
      url: pokemonObj.url
    }),
    image: new Image({
      url: pokemonObj.image_url,
      alt: buildFullName(pokemonObj)
    }),
    display: "CROPPED"
  });
};

const buildPokemonList = pokemonObjs => {
  let items = {};
  pokemonObjs
    .filter((_, i) => i < 30)
    .forEach(pokemonObj => {
      const fullName = buildFullName(pokemonObj);
      items[fullName] = {
        title: fullName,
        description: [
          buildFullType(pokemonObj),
          `최대 ${pokemonObj.max_cp} CP`
        ].join(` / `),
        image: new Image({
          url: pokemonObj.image_url,
          alt: fullName
        })
      };
    });
  return new List({ items: items });
};

const buildPokemonCounterList = pokemonObjs => {
  let items = {};
  pokemonObjs
    .filter((_, i) => i < 30)
    .forEach(pokemonObj => {
      const fullName = buildFullName(pokemonObj);
      const key = `${fullName}의 약점`;

      items[key] = {
        title: key,
        description: [
          buildFullType(pokemonObj),
          `최대 ${pokemonObj.max_cp} CP`
        ].join(` / `),
        image: new Image({
          url: pokemonObj.image_url,
          alt: fullName
        })
      };
    });
  return new List({ items: items });
};

const buildCounterList = pokemonObj => {
  let items = {};
  pokemonObj.counters.forEach(counter => {
    const pokemonObj = findPokemonWithForm(counter.name, counter.form);
    const fullName = buildFullName(pokemonObj);
    const key = `${fullName}`;

    if (items[key]) {
      return;
    }

    items[key] = {
      title: fullName,
      description: [
        `${counter.percentage * 100}%`,
        `${counter.quick} · ${counter.charge}`
      ].join(` / `),
      image: new Image({
        url: pokemonObj.image_url,
        alt: fullName
      })
    };
  });
  return new List({ items: items });
};

const buildSuggestions = pokemonObj => {
  return new Suggestions([
    ...pokemonObj.has_multi_form_type
      ? [pokemonObj.name, `💫 ${pokemonObj.name} (${pokemonObj.form})의 약점`]
      : [`💫 ${pokemonObj.name}의 약점`],
    ...pokemonObj.evolution.filter(el => el !== pokemonObj.name),
    buildFullType(pokemonObj),
    "❌ 닫기"
  ]);
};

const buildFullType = pokemonObj => `${pokemonObj.types.join(" · ")} 타입`;

const buildFullWeaknesses = pokemonObj =>
  `${pokemonObj.weaknesses_types.join(" · ")} 타입`;

const buildFullName = pokemonObj => {
  if (pokemonObj.has_multi_form_type) {
    return `${pokemonObj.name} (${pokemonObj.form})`;
  }
  if (pokemonObj.form === "캐스퐁") {
    return pokemonObj.name;
  }
  return `${pokemonObj.name} (${pokemonObj.form})`;
};

const buildChargeText = v => {
  let name = v.event ? `${v.name}(이벤트)` : v.name;
  return v.stab ? `**${name}**` : name;
};

const sortDPSWithStab = (a, b) =>
  (b.stab ? b.dps * 1.2 : b.dps) - (a.stab ? a.dps * 1.2 : a.dps);

const sortCounter = (a, b) => b.percentage - a.percentage;

const sortStrong = (a, b) => b.max_cp - a.max_cp;

exports.pokedexFulfillment = functions.https.onRequest(app);
