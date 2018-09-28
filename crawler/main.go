package main

import (
	"bytes"
	"encoding/json"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

// Pokemon 구조체는 포켓몬 정보를 구성합니다.
type Pokemon struct {
	Name     string   `json:"name"`     // 이름
	Number   int      `json:"number"`   // 전국도감 번호
	Form     string   `json:"form"`     // 폼
	Classify string   `json:"classify"` // 분류
	Info     string   `json:"info"`     // 설명
	Types    []string `json:"types"`    // 타입
	ATK      int      `json:"atk"`      // 공격
	DEF      int      `json:"def"`      // 방어
	HP       int      `json:"hp"`       // 체력

	CPRank int `json:"cp_rank"` // CP 순위
	MaxCP  int `json:"max_cp"`  // 최대 CP
	// MaxCPInResearchEncounters                int // 리서치 보상에서 최대 CP
	// MaxCPInMaxHatchedOrRaids                 int // 부화 및 레이드에서 최대 CP
	// MaxCPInMaxHatchedOrRaidsWithWeatherBoost int // 부화 및 레이드(날씨 부스트)에서 최대 CP
	// MaxCPInMaxWild                           int // 필드에서 최대 CP
	// MaxCPInMaxWildWithWeatherBoost           int // 필드(날씨 부스트)에서 최대 CP

	BaseCaptureRate   float64 `json:"base_capture_rate"`   // 기본 포획률
	BaseFleeRate      float64 `json:"base_flee_rate"`      // 기본 도주율
	BuddyWalkDistance int     `json:"buddy_walk_distance"` // 사탕을 얻기 위해 걸어야 하는 거리 (km)

	// CanShiny bool // 반짝이는 포켓몬 존재 여부

	ImageURL string `json:"image_url"` // 이미지 주소

	Evolution       []string `json:"evolution"`        // 진화
	WeaknessesTypes []string `json:"weaknesses_types"` // 취약한 타입

	QuickSkillList  []*Skill   // 빠른 공격 목록
	ChargeSkillList []*Skill   // 주요 공격 목록
	Counters        []*Counter `json:"counters"` // 카운터 포켓몬
}

// Skill 구조체는 스킬 정보를 구성합니다.
type Skill struct {
	Name  string  // 스킬 이름
	Type  string  // 스킬 속성
	DPS   float64 // 스킬 초당 공격력
	Stab  bool    // 자속 여부
	Event bool    // 이벤트 스킬 여부
}

// Counter 구조체는 카운터 정보를 구성합니다.
type Counter struct {
	Name        string  `json:"name"`         // 카운터 포켓몬 이름
	Form        string  `json:"form"`         // 카운터 포켓몬 폼
	QuickSkill  string  `json:"quick_skill"`  // 카운터 빠른 공격
	ChargeSkill string  `json:"charge_skill"` // 카운터 주요 공격
	Percentage  float64 `json:"percentage"`   // 유효 데미지
}

var (
	numberRe = regexp.MustCompile(`pokemon = { id: (\d+), name`)
)

func main() {
	pokemonList := []*Pokemon{}

	filepath.Walk("./raws", func(path string, info os.FileInfo, err error) error {
		if info.IsDir() {
			return nil
		}

		b, err := ioutil.ReadFile(path)
		if err != nil {
			return err
		}

		doc, err := goquery.NewDocumentFromReader(bytes.NewReader(b))
		if err != nil {
			return err
		}

		quickSkillList := []*Skill{}
		doc.Find(`article.all-moves table.moves:first-child tbody tr:not(.old)`).Each(func(i int, s *goquery.Selection) {
			t := s.Find(`td:first-child span`).AttrOr(`data-type`, ``)
			name := strings.TrimSpace(s.Find(`td:first-child a`).Text())
			dps := sToFloat(s.Find(`td:last-child`).Text())
			isStab := s.HasClass(`stab`)
			isEvent := s.HasClass(`event`)
			quickSkillList = append(quickSkillList, &Skill{t, name, dps, isStab, isEvent})
		})

		chargeSkillList := []*Skill{}
		doc.Find(`article.all-moves table.moves:last-child tbody tr:not(.old)`).Each(func(i int, s *goquery.Selection) {
			t := s.Find(`td:first-child span`).AttrOr(`data-type`, ``)
			name := strings.TrimSpace(s.Find(`td:first-child a`).Text())
			dps := sToFloat(s.Find(`td:last-child`).Text())
			isStab := s.HasClass(`stab`)
			isEvent := s.HasClass(`event`)
			chargeSkillList = append(chargeSkillList, &Skill{t, name, dps, isStab, isEvent})
		})

		counters := []*Counter{}
		doc.Find(`table.table-counter.all tbody tr:not(.old)`).Each(func(i int, s *goquery.Selection) {
			counters = append(counters, &Counter{
				Name:        trimName(strings.TrimSpace(s.Find(`td:nth-child(1)`).Text())),
				Form:        getForm(strings.TrimSpace(s.Find(`td:nth-child(1)`).Text())),
				QuickSkill:  strings.TrimSpace(s.Find(`td:nth-child(2)`).Text()),
				ChargeSkill: strings.TrimSpace(s.Find(`td:nth-child(3)`).Text()),
				Percentage:  perToFloat(strings.TrimSpace(s.Find(`td:nth-child(4)`).Text())),
			})
		})

		evolution := []string{}
		doc.Find(`div.evolution div.pokemon`).Each(func(i int, s *goquery.Selection) {
			evolution = append(evolution, strings.TrimSpace(s.Text()))
		})

		weaknessesTypes := []string{}
		breakpoint := ""
		doc.Find(`table.weaknesses tbody tr`).Each(func(i int, s *goquery.Selection) {
			if breakpoint != "" && breakpoint != s.Find(`span`).Text() {
				return
			}
			breakpoint = s.Find(`span`).Text()
			weaknessesTypes = append(weaknessesTypes, typeMap[strings.TrimSpace(s.Find(`a`).Text())])
		})

		pokemonList = append(pokemonList, &Pokemon{
			Name:              strings.TrimSpace(doc.Find(`h1.mobile-hidden`).Contents().Not("#forms").Text()),
			Number:            stoInt(numberRe.FindStringSubmatch(string(b))),
			Form:              getForm(doc.Find(`title`).Text()),
			Classify:          classifyMap[strings.TrimSpace(doc.Find(`h1.mobile-hidden`).ReplaceWith("#forms").Text())],
			Info:              strings.Trim(strings.TrimSpace(doc.Find(`p.description`).Text()), `"`),
			Types:             splitTypes(doc.Find(`div.large-type div`)),
			ATK:               toInt(doc.Find(`.table-stats:first-child tr:nth-child(1) td:nth-child(2)`).Text()),
			DEF:               toInt(doc.Find(`.table-stats:first-child tr:nth-child(2) td:nth-child(2)`).Text()),
			HP:                toInt(doc.Find(`.table-stats:first-child tr:nth-child(3) td:nth-child(2)`).Text()),
			CPRank:            toInt(doc.Find(`#cont > div > span > em`).Text()),
			MaxCP:             toInt(doc.Find(`article.pokemon-stats table.table-stats:nth-child(3) tr:last-child td:nth-child(2)`).Contents().Not(`a`).Text()),
			BaseCaptureRate:   perToFloat(doc.Find(`table.table-stats:last-child tr:nth-child(1) td:last-child`).Text()),
			BaseFleeRate:      perToFloat(doc.Find(`table.table-stats:last-child tr:nth-child(2) td:last-child`).Text()),
			BuddyWalkDistance: kmToInt(doc.Find(`table.table-stats:last-child tr:nth-child(3) td:last-child`).Text()),
			ImageURL:          getImageURL(doc),
			Evolution:         evolution,
			WeaknessesTypes:   weaknessesTypes,
			QuickSkillList:    quickSkillList,
			ChargeSkillList:   chargeSkillList,
			Counters:          counters,
		})

		return nil
	})

	sort.Slice(pokemonList, func(i, j int) bool {
		if pokemonList[i].Number < pokemonList[j].Number {
			return true
		}
		if pokemonList[i].Number > pokemonList[j].Number {
			return false
		}
		return true
	})

	f, err := os.Create("../functions/data.json")
	if err != nil {
		panic(err)
	}
	if err := json.NewEncoder(f).Encode(pokemonList); err != nil {
		panic(err)
	}
}

func stoInt(s []string) int {
	i, _ := strconv.Atoi(strings.Replace(s[1], `,`, ``, -1))
	return i
}

func toInt(s string) int {
	i, _ := strconv.Atoi(strings.TrimSpace(strings.Replace(s, `,`, ``, -1)))
	return i
}

func splitTypes(s *goquery.Selection) []string {
	ret := []string{}
	s.Each(func(i int, s *goquery.Selection) {
		ret = append(ret, typeMap[s.Text()])
	})
	return ret
}

func sToFloat(s string) float64 {
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

func perToFloat(s string) float64 {
	i, _ := strconv.Atoi(strings.TrimSuffix(s, "%"))
	return float64(i) / 100
}

func kmToInt(s string) int {
	i, _ := strconv.Atoi(strings.TrimSuffix(s, " km"))
	return i
}

func getForm(s string) string {
	switch {
	case strings.Contains(s, "캐스퐁의 모습"):
		return "캐스퐁"
	case strings.Contains(s, "알로라의 모습"):
		return "알로라"
	}
	return "캐스퐁"
}

func trimName(s string) string {
	s = strings.TrimSuffix(s, " (캐스퐁의 모습)")
	s = strings.TrimSuffix(s, " (알로라의 모습)")
	return s
}

func getImageURL(doc *goquery.Document) string {
	if doc.Find(`article.forms-block div.forms a.form`).Length() >= 2 {
		return `https://pokemon.gameinfo.io` + doc.Find(`article.forms-block div.forms a.form.active img`).AttrOr(`src`, ``)
	}
	return `https://pokemon.gameinfo.io` + doc.Find(`article.images-block img`).First().AttrOr(`src`, ``)
}
