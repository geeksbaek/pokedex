"use strict";

const {
  dialogflow,
  BasicCard,
  Table,
  Permission,
  BrowseCarousel,
  BrowseCarouselItem,
  MediaObject,
  Button,
  List,
  Image,
  LinkOutSuggestion,
  Suggestions
} = require("actions-on-google");

const stringSimilarity = require("string-similarity");
const Josa = require("josa-js");

const functions = require("firebase-functions");
const fs = require("fs");
const rp = require("request-promise-native");
const cheerio = require("cheerio");

const app = dialogflow({ debug: true });

// DB로 사용할 JSON 파일 읽기
const pokedex = JSON.parse(fs.readFileSync("data/ko/pokemon.min.json", "utf8"));
const pokedexEn = JSON.parse(
  fs.readFileSync("data/en/pokemon.min.json", "utf8")
);
const mythical = JSON.parse(fs.readFileSync("data/mythical.json", "utf8"));
const legendary = JSON.parse(fs.readFileSync("data/legendary.json", "utf8"));
const regional = JSON.parse(fs.readFileSync("data/regional.json", "utf8"));
const weather_boost = JSON.parse(
  fs.readFileSync("data/weather_boost.json", "utf8")
);
const nesting_species = JSON.parse(
  fs.readFileSync("data/nesting_species.json", "utf8")
);
const bgm = JSON.parse(fs.readFileSync("data/bgm.json", "utf8"));

const reNameForm = /([^ ]+) \((.*)\)/;
const reAddComma = /\B(?=(\d{3})+(?!\d))/g;

const exclamationBeepURL = `https://storage.googleapis.com/pokedex-assistants/emerald%200015%20-%20Exclamation%20Beep.mp3`;

app.intent("포켓몬 검색", (conv, _, option) => {
  // name과 가장 비슷한 이름을 가진 포켓몬을 찾는다.
  const pokemons = findMostSimilarPokemons(conv, option);
  const name = pokemons[0].name;

  // 검색 결과가 하나인 경우 하나의 포켓몬을 BasicCard 로 응답한다.
  if (pokemons.length === 1) {
    conv.ask(buildTextWithExclamationBeep(`${name}. ${pokemons[0].classify}.`));
    conv.ask(`${pokemons[0].info}`);
    conv.ask(buildPokemonCard(pokemons[0]));
    conv.ask(new Suggestions(buildSuggestions(pokemons[0])));
    conv.ask(
      new LinkOutSuggestion({
        name: "pokemon.gameinfo.io",
        url: pokemons[0].url
      })
    );
    return;
  }

  // 검색 결과가 여러 개인 경우 포켓몬의 목록을 List 로 응답한다.
  conv.ask(
    `여러 폼 타입의 ${Josa.r(name, "이/가")} 있습니다. ` +
      `궁금한 포켓몬을 선택하세요.`
  );
  conv.ask(buildPokemonList(pokemons));
  conv.ask(new Suggestions(`❌ 닫기`));
});

app.intent("포켓몬 IV 차트 묻기", (conv, _, option) => {
  // name과 가장 비슷한 이름을 가진 포켓몬을 찾는다.
  const pokemons = findMostSimilarPokemons(conv, option);
  const name = pokemons[0].name;

  if (pokemons.length === 1) {
    conv.ask(
      buildTextWithExclamationBeep(
        `${buildFullName(pokemons[0])}의 IV 차트입니다.`
      )
    );
    conv.ask(
      `<speak>날씨가 ${buildWeatherBoost(
        pokemons[0]
      )}일 때 <sub alias="부스트">부스트🔥</sub> 됩니다.</speak>`
    );
    conv.ask(buildPokemonIVChart(pokemons[0]));
    conv.ask(new Suggestions(buildFullName(pokemons[0])));
    conv.ask(
      new Suggestions(
        buildSuggestions(pokemons[0]).filter(el => !el.includes("IV"))
      )
    );
    conv.ask(
      new LinkOutSuggestion({
        name: "pokemon.gameinfo.io",
        url: pokemons[0].url
      })
    );
    return;
  }

  // 검색 결과가 여러 개인 경우 포켓몬의 목록을 List 로 응답한다.
  conv.ask(
    `여러 폼 타입의 ${Josa.r(name, "이/가")} 있습니다. ` +
      `궁금한 포켓몬을 선택하세요.`
  );
  conv.ask(buildPokemonList(pokemons, "IV"));
  conv.ask(new Suggestions(`❌ 닫기`));
});

app.intent("포켓몬 약점", (conv, _, option) => {
  // name과 가장 비슷한 이름을 가진 포켓몬을 찾는다.
  const pokemons = findMostSimilarPokemons(conv, option);
  const name = pokemons[0].name;

  if (pokemons.length === 1) {
    const fullName = buildFullName(pokemons[0]);
    conv.ask(
      buildTextWithExclamationBeep(
        `${Josa.r(fullName, "은/는")} ${buildFullType(
          pokemons[0]
        )}이며, ${buildFullWeaknesses(pokemons[0]).replace(
          /\*/g,
          ""
        )} 타입에 취약합니다.`
      )
    );
    conv.ask(buildCounterList(pokemons[0]));
    conv.ask(new Suggestions(buildFullName(pokemons[0])));
    conv.ask(
      new Suggestions(
        buildSuggestions(pokemons[0]).filter(el => !el.includes("약점"))
      )
    );
    conv.ask(
      new LinkOutSuggestion({
        name: "pokemon.gameinfo.io",
        url: pokemons[0].url
      })
    );
    return;
  }

  conv.ask(
    `여러 타입의 ${Josa.r(name, "이/가")} 있습니다. ` +
      `약점이 궁금한 포켓몬을 선택해주세요.`
  );

  conv.ask(buildPokemonList(pokemons, "약점"));
  conv.ask(new Suggestions([name, `❌ 닫기`]));
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
    conv.ask(`${types.join("·")} 타입을 가지는 포켓몬이 없습니다.`);
    conv.ask(new Suggestions(types.map(el => `${el} 타입 포켓몬`)));
    return;
  } else if (find.length === 1) {
    conv.ask(
      buildTextWithExclamationBeep(
        `${types.join("·")} 타입을 가지는 포켓몬을 찾았습니다.`
      )
    );
    conv.ask(buildPokemonCard(find[0]));
    conv.ask(
      new Suggestions(
        buildSuggestions(find[0]).filter(el => !el.includes("타입"))
      )
    );
    conv.ask(
      new LinkOutSuggestion({
        name: "pokemon.gameinfo.io",
        url: find[0].url
      })
    );
    return;
  }

  conv.ask(
    buildTextWithExclamationBeep(
      `${types.join(
        "·"
      )} 타입을 가지는 포켓몬을 찾았습니다. 궁금한 포켓몬을 선택해주세요.`
    )
  );
  conv.ask(buildPokemonList(find));
  if (types.length >= 2) {
    conv.ask(new Suggestions(types.map(el => `${el} 타입 포켓몬`)));
  }
  conv.ask(new Suggestions(`❌ 닫기`));
});

app.intent("이벤트 묻기", async conv => {
  conv.ask("이벤트에 대한 정보입니다.");
  conv.ask(
    new BasicCard({
      title: `무슨 이벤트가 열리고 있을까요?`,
      buttons: new Button({
        title: "이벤트 확인",
        url: "https://pokemon.gameinfo.io/ko/events"
      }),
      display: "CROPPED"
    })
  );
  conv.ask(new Suggestions(`❌ 닫기`));
});

app.intent("BGM", conv => {
  let bgm_list = {};
  bgm.forEach(el => (bgm_list[el.url] = { title: el.title }));

  conv.ask("어떤 BGM을 듣고 싶으세요?");
  conv.ask(new List({ items: bgm_list }));
  conv.ask(new Suggestions(`❌ 닫기`));
});

app.intent("BGM select", (conv, _, option) => {
  const text = option || conv.arguments.parsed.input.text;
  const find = bgm.find(el => el.url === text);

  conv.ask("<speak><sub alias=''>🎶</sub></speak>");
  conv.ask(
    new MediaObject({
      name: find.title,
      url: find.url,
      description: "Release date: Nov 21st, 1999",
      icon: new Image({
        url:
          "http://23.237.126.42/soundcovers/gameboy-gbs/thumbs_large/gbc_pokemongold.jpg",
        alt: "Pokemon Gold"
      })
    })
  );
  conv.ask(new Suggestions(["다른 BGM 틀어줘", `❌ 닫기`]));
});

app.intent("BGM finish", conv => {
  const mediaStatus = conv.arguments.get("MEDIA_STATUS");
  let response = ["Unknown media status received."];
  if (mediaStatus && mediaStatus.status === "FINISHED") {
    response = ["정말 좋은 BGM 이었죠?", "추억이 새록새록 돋아나네요."];
  }
  conv.ask(response[Math.floor(Math.random() * response.length)]);
  conv.ask(new Suggestions(["다른 BGM 틀어줘", `❌ 닫기`]));
});

const findPokemon = name => pokedex.filter(el => el.name === name);

const findPokemonWithForm = (name, form) =>
  pokedex.find(el => el.name === name && el.form === form);

const findMostSimilarPokemons = (conv, option) => {
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

  let name = conv.parameters["name"];
  let form = conv.parameters["form"];

  const pokemon = stringSimilarity.findBestMatch(
    name,
    pokedex.map(el => el.name)
  ).bestMatch.target;

  if (form) {
    return [findPokemonWithForm(pokemon, form)] || pokedex[0];
  }
  return findPokemon(pokemon) || pokedex[0];
};

const buildPokemonCard = pokemonObj => {
  let regionalText = "";
  if (regional[pokemonObj.number]) {
    regionalText = `  \n📍 지역 한정: ${regional[pokemonObj.number].where}`;
  }

  return new BasicCard({
    text:
      `노말 어택: ${pokemonObj.quick
        .sort(sortDPSWithStab)
        .map(buildChargeText)
        .join("·")}  \n` +
      `스페셜 어택: ${pokemonObj.charge
        .sort(sortDPSWithStab)
        .map(buildChargeText)
        .join("·")}  \n  \n` +
      `🤢 약점: ${buildFullWeaknesses(pokemonObj)}  \n` +
      `😎 저항: ${buildFullResistants(pokemonObj)}  \n` +
      `🔥 날씨 부스트: ${buildWeatherBoost(pokemonObj)}` +
      regionalText,
    title: `${buildFullName(pokemonObj)} #${("000" + pokemonObj.number).slice(
      -3
    )}`,
    subtitle: `${buildFullType(pokemonObj)} / 최대 CP ${pokemonObj.max_cp}`,

    image: new Image({
      url: pokemonObj.image_url,
      alt: buildFullName(pokemonObj)
    }),
    display: "CROPPED"
  });
};

const buildPokemonIVChart = pokemonObj => {
  let lv20chart = calcCPChart(pokemonObj, 20).filter(el => el[3] >= 41);
  let lv25chart = calcCPChart(pokemonObj, 25).filter(el => el[3] >= 41);
  let lv30chart = calcCPChart(pokemonObj, 30).filter(el => el[3] >= 41);
  let lv35chart = calcCPChart(pokemonObj, 35).filter(el => el[3] >= 41);

  let rows = [];
  for (let i = 0; i < lv20chart.length; i++) {
    rows.push({
      cells: [
        `${((lv20chart[i][3] / 45) * 100).toFixed(0)}%`,
        `${lv20chart[i][4].toString().replace(reAddComma, ",")}`,
        `${lv25chart[i][4].toString().replace(reAddComma, ",")}`,
        `${lv30chart[i][4].toString().replace(reAddComma, ",")}`,
        `${lv35chart[i][4].toString().replace(reAddComma, ",")}`
      ]
    });
  }

  return new Table({
    title: `${buildFullName(pokemonObj)} IV 차트`,
    image: new Image({
      url: pokemonObj.image_url,
      alt: buildFullName(pokemonObj)
    }),
    columns: [
      { header: "IV", align: "CENTER" },
      { header: "레이드", align: "CENTER" },
      { header: "레이드🔥", align: "CENTER" },
      { header: "야생", align: "CENTER" },
      { header: "야생🔥", align: "CENTER" }
    ],
    rows: rows
  });
};

const buildPokemonList = (pokemonObjs, suffix) => {
  let items = {};
  pokemonObjs
    .filter((_, i) => i < 30)
    .forEach(pokemonObj => {
      const fullName = buildFullName(pokemonObj);
      const key = suffix ? `${fullName} ${suffix}` : fullName;

      items[key] = {
        title: key,
        description: [
          buildFullType(pokemonObj),
          `최대 CP ${pokemonObj.max_cp}`
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
    const find = findPokemonWithForm(counter.name, counter.form);
    const fullName = buildFullName(find);
    const key = `${fullName}`;

    if (items[key]) {
      return;
    }

    let comb = [];
    pokemonObj.quick.forEach(q => {
      pokemonObj.charge.forEach(c => {
        comb.push({
          quick: q.type,
          quick_deal: q.stab ? 1.2 : 1,
          charge: c.type,
          charge_deal: c.stab ? 1.2 : 1
        });
      });
    });

    let deals = comb.map(el => {
      let quickDeal = 1;
      let chargeDeal = 1;
      find.weaknesses.concat(find.resistants).forEach(w => {
        if (w.type === el.quick) {
          quickDeal = quickDeal * w.deal * el.quick_deal;
        }
        if (w.type === el.charge) {
          chargeDeal = chargeDeal * w.deal * el.charge_deal;
        }
      });
      return (quickDeal + chargeDeal) / 2;
    });

    let avg = Number(
      (deals.reduce((p, c) => p + c, 0) / deals.length).toFixed(2)
    );

    items[key] = {
      title: fullName,
      description: [
        `${counter.percentage * 100}%`,
        `${counter.quick}·${counter.charge}`,
        Number(avg.toFixed(1)) === 1
          ? `😑 ${pokemonObj.name}에게 받는 평균 피해 100%`
          : avg > 1
          ? `🤢 ${pokemonObj.name}에게 받는 평균 피해 ${(avg * 100).toFixed(
              0
            )}%`
          : `😎 ${pokemonObj.name}에게 받는 평균 피해 ${(avg * 100).toFixed(
              0
            )}%`
      ]
        .filter(el => el)
        .join(` / `),
      image: new Image({
        url: find.image_url,
        alt: fullName
      })
    };
  });
  return new List({
    title: `${buildFullName(pokemonObj)}에게 강한 포켓몬`,
    items: items
  });
};

const buildSuggestions = pokemonObj => {
  return [
    ...(pokemonObj.has_multi_form_type
      ? [
          pokemonObj.name,
          `🤢 ${pokemonObj.name} (${pokemonObj.form}) 약점`,
          `📑 ${pokemonObj.name} (${pokemonObj.form}) IV`
        ]
      : [`🤢 ${pokemonObj.name} 약점`, `📑 ${pokemonObj.name} IV`]),
    nesting_species.includes(pokemonObj.number)
      ? `${pokemonObj.name} 둥지`
      : null,
    ...pokemonObj.evolution.filter(el => el !== pokemonObj.name),
    buildFullType(pokemonObj),
    "❌ 닫기"
  ].filter(el => el != null);
};

const buildFullType = pokemonObj => `${pokemonObj.types.join("·")} 타입`;

const buildFullWeaknesses = pokemonObj =>
  `${pokemonObj.weaknesses
    .sort((a, b) => a.deal < b.deal)
    .map(el => (el.deal >= 2.56 ? `**${el.type}**` : el.type))
    .join("·")}`;

const buildFullResistants = pokemonObj =>
  `${pokemonObj.resistants
    .sort((a, b) => a.deal > b.deal)
    .map(el => (el.deal <= 0.39 ? `**${el.type}**` : el.type))
    .join("·")}`;

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

const buildWeatherBoost = pokemonObj =>
  [...new Set(pokemonObj.types.map(t => weather_boost[t].name))].join(", ");

const buildTextWithExclamationBeep = str =>
  `<speak><audio src="${exclamationBeepURL}"/><break time="medium"/>${str}</speak>`;

const sortDPSWithStab = (a, b) =>
  (b.stab ? b.dps * 1.2 : b.dps) - (a.stab ? a.dps * 1.2 : a.dps);

const sortCounter = (a, b) => b.percentage - a.percentage;

const sortStrong = (a, b) => b.max_cp - a.max_cp;

const calcCPChart = (pokemonObj, level) => {
  let data = [];
  let cpm = {
    15: 0.51739395,
    20: 0.5974,
    25: 0.667934,
    30: 0.7317,
    35: 0.76156384,
    40: 0.7903
  }[level];

  for (let i = 12; i <= 15; i++)
    for (let j = 12; j <= 15; j++)
      for (let k = 12; k <= 15; k++)
        data.push([i, j, k, i + j + k, calcCP(pokemonObj, [i, j, k], cpm)]);

  return data.sort((a, b) => (b[3] == a[3] ? b[4] - a[4] : b[3] - a[3]));
};

const calcCP = (pokemonObj, iv, cpm) => {
  return Math.max(
    10,
    Math.floor(
      0.1 *
        Math.pow((pokemonObj.hp + iv[0]) * cpm, 0.5) *
        (pokemonObj.atk + iv[1]) *
        cpm *
        Math.pow((pokemonObj.def + iv[2]) * cpm, 0.5)
    )
  );
};

const isNesting = pokemonObj => {
  // 아래 코드 작동 안함
  // const $ = await rp({
  //   uri: "https://pokemongo.gamepress.gg/pokemon-go-nesting-species-list",
  //   transform: body => cheerio.load(body)
  // });
  // let anchors = $(
  //   ".views-view-grid.horizontal.cols-4.clearfix span.field-content > a"
  // );
  // let nesting = [];
  // anchors.forEach(el =>
  //   nesting.push(Number(el.getAttribute("href").split("/")[2]))
  // );
  // console.log(nesting);
  // return nesting.includes(pokemonObj.number);
};

exports.pokedexFulfillment = functions
  .region("asia-northeast1")
  .https.onRequest(app);
