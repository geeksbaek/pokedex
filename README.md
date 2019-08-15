# pokedex

포켓몬 도감(pokedex)은 모바일 게임 [Pokémon GO](https://www.pokemongo.com/)를 위한 구글 어시스턴트 Action 입니다.

현재 포켓몬 도감에는 Pokémon GO에서 만날 수 있는 모든 포켓몬의 데이터가 들어있습니다.

## Features

### 포켓몬 검색

- `리자몽 정보`
- `이상해꽃 물어봐줘`
- `알로라 라이츄 정보 알려줘`

특정 포켓몬을 검색할 수 있습니다.

### 타입의 포켓몬 검색

- `피카츄의 속성 물어봐`
- `이상해씨의 타입 물어봐`
- `비행 타입과 전기 타입을 가지는 포켓몬은?`

특정 타입의 포켓몬들을 검색할 수 있습니다.

### 포켓몬의 약점 검색

- `뮤츠의 상성 물어봐`
- `파이어의 카운터 물어봐`
- `레지아이스한테 강한 포켓몬 물어봐`

특정 포켓몬에게 가장 큰 데미지를 줄 수 있는 포켓몬을 검색할 수 있습니다.
카운터 포켓몬은 소스에서 가져온 데이터를 기반으로 카운터 포켓몬이 역으로 받는 평균 피해량까지 계산하여 보여줍니다.

아래는 이상해꽃의 약점을 검색했을 때 평균 피해량이 계산되는 방식입니다.

1. 이상해꽃이 사용할 수 있는 모든 노말/스페셜 어택의 조합을 계산
2. 각각의 조합과 카운터 포켓몬 간의 상성을 계산 (자속 여부도 계산에 포함)
3. 모든 어택 조합이 카운터 포켓몬과 무상성인 경우, `이상해꽃에게 받는 평균 피해 100%`로 표기함
4. 상성이 존재하는 경우 각각의 상성 계산 결과의 평균을 `이상해꽃에게 받는 평균 피해 ${상성 계산 평균값}%`로 표기함

### 포켓몬의 IV 차트 검색

- `멜탄 IV 물어봐`
- `스이쿤 IV 차트`
- `잉어킹 IV`

포켓몬의 IV 차트를 확인할 수 있습니다. IV를 아래 4개 컬럼으로 출력합니다.

20레벨(레이드) / 25레벨(날씨 부스트일 때 레이드) / 30레벨(야생) / 35레벨(날씨 부스트일 때 야생)

### 둥지 검색

- `파이리 둥지 물어봐`
- `이 근처에 무슨 둥지 있는지 물어봐`
- `화랑공원이 무슨 포켓몬 둥지인지 물어봐`

특정 포켓몬의 둥지, 또는 내 위치에서 가장 가까운 곳의 포켓몬 둥지를 물어볼 수 있습니다.
포켓몬 둥지 조회는 권한 요청을 거쳐 사용자의 위치 정보 사용 동의를 받은 뒤에 이용할 수 있습니다.

### BGM 듣기

- `브금 틀어줘`
- `노래 틀어줘`
- `BGM 틀어줘`

포켓몬스터 골드 BGM의 일부를 들을 수 있습니다.

## Usage

포켓몬 도감은 구글 어시스턴트 위에서 구동되는 `action` 입니다. `action`은 별도의 설치를 필요로 하지 않습니다.

### 구글 어시스턴트 호출 방법

| OS           | 최소 지원 버전       | 구글 어시스턴트 호출                                                                                       |
| ------------ | -------------- | ------------------------------------------------------------------------------------------------- |
| Android      | Android 5.0 이상 | 스마트폰 또는 태블릿에서 홈 화면을 길게 터치하거나 "Ok Google"이라고 말합니다.                                                 |
| iPhone, iPad | iOS 10 이상      | [자세히 보기](https://support.google.com/assistant/answer/7172657?co=GENIE.Platform%3DiOS&hl=ko&oco=1) |

### 구글 어시스턴트 내에서 포켓몬 도감 사용 방법

#### 명시적 호출

구글 어시스턴트에게 포켓몬 도감을 명시적으로 호출한 뒤 사용하는 방법입니다.

`포켓몬 도감과 대화` 와 같은 명령을 통해 포켓몬 도감을 명시적으로 호출할 수 있으며,
사용자가 환영 메시지를 확인하고 기본적인 사용 방법을 안내받을 수 있습니다.

1. `포켓몬 도감과 대화`
2. `그란돈의 IV 알려줘`

<small>[참고 영상](https://youtu.be/xsqjDDMybVc)</small>

#### 딥 링크 호출

구글 어시스턴트에게 포켓몬 도감에서 제공하는 `invocation name`과 `argument`를 초기 요청에 포함시켜 빠르게 원하는 응답을 받을 수 있는 방법입니다.

아래는 `invocation name`과 `argument`를 구분하는 몇 가지 예시입니다.

| 명령             | invocation name | argument |
| -------------- | --------------- | -------- |
| `그란돈의 IV 알려줘`  | `IV`            | `그란돈`    |
| `파치리스의 약점 알려줘` | `약점`            | `파치리스`   |

딥 링크를 이용하면 명시적 호출에서는 두 단계를 거쳐야 했던 명령을 한 단계로 줄일 수 있습니다.

<small>[참고 영상](https://youtu.be/rExRwYy5nFE)</small>

1. `포켓몬 도감에게 그란돈의 IV 물어봐`

#### 암시적 호출

구글 어시스턴트에게 명령을 할 때, 초기 요청에 포켓몬 도감을 명시하지 않고도  `invocation name`과 `argument`만 요청해도 포켓몬 도감의 응답을 받을 수 있는 방법입니다.

`invocation name`과 `argument`이 구글 어시스턴트에 전달되면 구글의 추천 알고리즘이 매칭되는 적절한 `action`을 찾아 연결해줍니다.

다만 구글의 추천 알고리즘이 반드시 매칭을 보장해주지는 않습니다.

1. `그란돈 약점이 뭐야`

<small>[참고 이미지](https://i.imgur.com/kG6aNf2.jpg)</small>

## Data Source

포켓몬 도감은 아래 웹사이트의 데이터를 기반합니다.

- <https://pokemon.gameinfo.io>
