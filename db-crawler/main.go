package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/MichaelTJones/walk"
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

	HasMultiFormType bool `json:"has_multi_form_type"` // 다른 폼 타입의 존재 여부

	URL string `json:"url"` // 관련 링크

	// CPRank int `json:"cp_rank"` // CP 순위
	MaxCP                                    int `json:"max_cp"`              // 최대 CP
	MaxCPInResearchEncounters                int `json:"max_cp_research"`     // 리서치 보상에서 최대 CP
	MaxCPInMaxHatchedOrRaids                 int `json:"max_cp_raid"`         // 부화 및 레이드에서 최대 CP
	MaxCPInMaxHatchedOrRaidsWithWeatherBoost int `json:"max_cp_raid_boosted"` // 부화 및 레이드(날씨 부스트)에서 최대 CP
	MaxCPInMaxWild                           int `json:"max_cp_wild"`         // 필드에서 최대 CP
	MaxCPInMaxWildWithWeatherBoost           int `json:"max_cp_wild_boosted"` // 필드(날씨 부스트)에서 최대 CP

	BaseCaptureRate   float64 `json:"base_capture_rate"`   // 기본 포획률
	BaseFleeRate      float64 `json:"base_flee_rate"`      // 기본 도주율
	BuddyWalkDistance int     `json:"buddy_walk_distance"` // 사탕을 얻기 위해 걸어야 하는 거리 (km)

	// CanShiny bool // 반짝이는 포켓몬 존재 여부

	ImageURL string `json:"image_url"` // 이미지 주소

	Evolution  []string `json:"evolution"`  // 진화
	Weaknesses []*Deal  `json:"weaknesses"` // 취약 타입
	Resistants []*Deal  `json:"resistants"` // 저항 타입

	QuickSkillList  []*Skill   `json:"quick"`    // 빠른 공격 목록
	ChargeSkillList []*Skill   `json:"charge"`   // 주요 공격 목록
	Counters        []*Counter `json:"counters"` // 카운터 포켓몬
}

type Deal struct {
	Type string  `json:"type"`
	Deal float64 `json:"deal"`
}

// Skill 구조체는 스킬 정보를 구성합니다.
type Skill struct {
	Name  string  `json:"name"`  // 스킬 이름
	Type  string  `json:"type"`  // 스킬 속성
	DPS   float64 `json:"dps"`   // 스킬 초당 공격력
	Stab  bool    `json:"stab"`  // 자속 여부
	Event bool    `json:"event"` // 이벤트 스킬 여부
}

// Counter 구조체는 카운터 정보를 구성합니다.
type Counter struct {
	Name        string  `json:"name"`       // 카운터 포켓몬 이름
	Form        string  `json:"form"`       // 카운터 포켓몬 폼
	QuickSkill  string  `json:"quick"`      // 카운터 빠른 공격
	ChargeSkill string  `json:"charge"`     // 카운터 주요 공격
	Percentage  float64 `json:"percentage"` // 유효 데미지
}

var (
	numberRe = regexp.MustCompile(`pokemon = { id: (\d+), name`)
	locales  = []string{"ko" /*, "en"*/}
	doCrawl  bool
)

func init() {
	flag.BoolVar(&doCrawl, "crawl", false, "크롤링 수행 여부")
	for _, locale := range locales {
		os.MkdirAll("./raws/"+locale, os.ModePerm)
		os.MkdirAll("../functions/data/"+locale, os.ModePerm)
	}
}

func main() {
	flag.Parse()

	if doCrawl {
		for _, locale := range locales {
			crawl(locale)
		}
	}

	for _, locale := range locales {
		pokemonList := []*Pokemon{}
		formMap := map[string]bool{}

		walk.Walk("./raws/"+locale, func(path string, info os.FileInfo, err error) error {
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

			if doc.Find(`article.images-block > div > div > a:nth-child(1) > picture`).Length() == 0 {
				return nil
			}

			defer log.Println(path)

			quickSkillList := []*Skill{}
			doc.Find(`article.all-moves table.moves:first-child tbody tr:not(.old)`).Each(func(i int, s *goquery.Selection) {
				t := convTypeLang(s.Find(`td:first-child span`).AttrOr(`data-type`, ``), locale)
				name := strings.TrimSpace(strings.TrimRight(strings.TrimSpace(s.Find(`td:first-child a`).Text()), "(event)"))
				dps := sToFloat(s.Find(`td:last-child`).Text())
				isStab := s.HasClass(`stab`)
				isEvent := s.HasClass(`event`)
				quickSkillList = append(quickSkillList, &Skill{name, t, dps, isStab, isEvent})
			})

			chargeSkillList := []*Skill{}
			doc.Find(`article.all-moves table.moves:nth-child(2) tbody tr:not(.old)`).Each(func(i int, s *goquery.Selection) {
				t := convTypeLang(s.Find(`td:first-child span`).AttrOr(`data-type`, ``), locale)
				name := strings.TrimSpace(strings.TrimRight(strings.TrimSpace(s.Find(`td:first-child a`).Text()), "(event)"))
				dps := sToFloat(s.Find(`td:last-child`).Text())
				isStab := s.HasClass(`stab`)
				isEvent := s.HasClass(`event`)
				chargeSkillList = append(chargeSkillList, &Skill{name, t, dps, isStab, isEvent})
			})

			html, err := doc.Html()
			if err != nil {
				panic(err)
			}
			matched := reIDAndForm.FindStringSubmatch(html)
			if len(matched) != 3 {
				fmt.Println(matched)
				panic("not matched id and form regexp")
			}

			counterURL := fmt.Sprintf("https://pokemon.gameinfo.io/ko/pokemon/counters?id=%v&form=%v", matched[1], matched[2])
			counterDoc, err := goquery.NewDocument(counterURL)
			if err != nil {
				panic(err)
			}

			counters := []*Counter{}
			counterDoc.Find(`table.table-counter > tbody > tr:not(.old)`).Each(func(i int, s *goquery.Selection) {
				form := getForm(strings.TrimSpace(s.Find(`td:nth-child(1)`).Text()), locale)
				if form == "Purified" || form == "Shadow" {
					return
				}
				counters = append(counters, &Counter{
					Name:        trimName(strings.TrimSpace(s.Find(`td:nth-child(1)`).Text())),
					Form:        getForm(strings.TrimSpace(s.Find(`td:nth-child(1)`).Text()), locale),
					QuickSkill:  strings.TrimSpace(s.Find(`td:nth-child(2)`).Text()),
					ChargeSkill: strings.TrimSpace(s.Find(`td:nth-child(3)`).Text()),
					Percentage:  perToFloat(strings.TrimSpace(s.Find(`td:nth-child(4)`).Text())),
				})
			})

			evolution := []string{}
			doc.Find(`div.evolution div.pokemon`).Each(func(i int, s *goquery.Selection) {
				evolution = append(evolution, strings.TrimSpace(s.Text()))
			})

			weaknesses := []*Deal{}
			doc.Find(`table.weaknesses.weak tbody tr`).Each(func(i int, s *goquery.Selection) {
				weaknesses = append(weaknesses, &Deal{
					Type: convTypeLang(strings.TrimSpace(s.Find(`td:nth-child(1) > a`).Text()), locale),
					Deal: mustParseDeal(s.Find(`td:nth-child(2) > span`).Text()),
				})
			})

			resistants := []*Deal{}
			doc.Find(`table.weaknesses.res tbody tr`).Each(func(i int, s *goquery.Selection) {
				resistants = append(resistants, &Deal{
					Type: convTypeLang(strings.TrimSpace(s.Find(`td:nth-child(1) > a`).Text()), locale),
					Deal: mustParseDeal(s.Find(`td:nth-child(2) > span`).Text()),
				})
			})

			pokemonList = append(pokemonList, &Pokemon{
				Name:     strings.TrimSpace(strings.Split(doc.Find(`div.title h1`).Text(), "-")[0]),
				Number:   stoInt(numberRe.FindStringSubmatch(string(b))),
				Form:     getFormFromTitle(doc.Find(`section.heading > div.title > h1`).Text(), locale),
				Classify: fetchClassify(strings.TrimSpace(strings.Split(doc.Find(`div.title h1`).Text(), "-")[0]), locale),
				Info:     strings.Trim(strings.TrimSpace(doc.Find(`p.description`).Text()), `"`),
				Types:    splitTypes(doc.Find(`div.large-type div`), locale),
				ATK:      toInt(doc.Find(`.table-stats:first-child tr:nth-child(1) td:nth-child(2)`).Text()),
				DEF:      toInt(doc.Find(`.table-stats:first-child tr:nth-child(2) td:nth-child(2)`).Text()),
				HP:       toInt(doc.Find(`.table-stats:first-child tr:nth-child(3) td:nth-child(2)`).Text()),
				URL:      doc.Find(`meta[property="og:url"]`).First().AttrOr("content", ""),
				// CPRank:            toInt(doc.Find(`#cont > div > span > em`).Text()),
				MaxCPInResearchEncounters:                toInt(doc.Find(`article.pokemon-stats table.table-stats:nth-child(3) tr:nth-child(1) td:nth-child(2)`).Contents().Not(`a`).Text()),
				MaxCPInMaxHatchedOrRaids:                 toInt(doc.Find(`article.pokemon-stats table.table-stats:nth-child(3) tr:nth-child(2) td:nth-child(2)`).Contents().Not(`a`).Text()),
				MaxCPInMaxWild:                           toInt(doc.Find(`article.pokemon-stats table.table-stats:nth-child(3) tr:nth-child(3) td:nth-child(2)`).Contents().Not(`a`).Text()),
				MaxCP:                                    toInt(doc.Find(`article.pokemon-stats table.table-stats:nth-child(3) tr:nth-child(4) td:nth-child(2)`).Contents().Not(`a`).Text()),
				MaxCPInMaxHatchedOrRaidsWithWeatherBoost: toInt(doc.Find(`#stats > div > table:nth-child(5) > tbody > tr:nth-child(1) > td:nth-child(2)`).Contents().Not(`a`).Text()),
				MaxCPInMaxWildWithWeatherBoost:           toInt(doc.Find(`#stats > div > table:nth-child(5) > tbody > tr:nth-child(2) > td:nth-child(2)`).Contents().Not(`a`).Text()),
				BaseCaptureRate:                          perToFloat(doc.Find(`table.table-stats:last-child tr:nth-child(1) td:last-child`).Text()),
				BaseFleeRate:                             perToFloat(doc.Find(`table.table-stats:last-child tr:nth-child(2) td:last-child`).Text()),
				BuddyWalkDistance:                        kmToInt(doc.Find(`table.table-stats:last-child tr:nth-child(3) td:last-child`).Text()),
				ImageURL:                                 getImageURL(doc),
				Evolution:                                evolution,
				Weaknesses:                               weaknesses,
				Resistants:                               resistants,
				QuickSkillList:                           quickSkillList,
				ChargeSkillList:                          chargeSkillList,
				Counters:                                 counters,
			})

			formMap[getFormFromTitle(doc.Find(`section.heading > div.title > h1`).Text(), locale)] = true

			return nil
		})

		fmt.Println(formMap)

		sort.Slice(pokemonList, func(i, j int) bool {
			if pokemonList[i].Number < pokemonList[j].Number {
				return true
			}
			if pokemonList[i].Number > pokemonList[j].Number {
				return false
			}
			return true
		})

		for i, p1 := range pokemonList {
			hasMultiFormType := false
			for j, p2 := range pokemonList {
				if i != j && p1.Name == p2.Name {
					hasMultiFormType = true
					break
				}
			}
			pokemonList[i].HasMultiFormType = hasMultiFormType
		}

		f, err := os.Create("../functions/data/" + locale + "/pokemon.json")
		if err != nil {
			panic(err)
		}
		encoder := json.NewEncoder(f)
		encoder.SetIndent("", "\t")
		if err := encoder.Encode(pokemonList); err != nil {
			panic(err)
		}

		f, err = os.Create("../functions/data/" + locale + "/pokemon.min.json")
		if err != nil {
			panic(err)
		}
		if err := json.NewEncoder(f).Encode(pokemonList); err != nil {
			panic(err)
		}
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

func splitTypes(s *goquery.Selection, locale string) []string {
	ret := []string{}
	s.Each(func(i int, s *goquery.Selection) {
		ret = append(ret, convTypeLang(s.Text(), locale))
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

var formRe = regexp.MustCompile(`\s\((.*)\)`)

func getForm(s string, locale string) string {
	finded := formRe.FindStringSubmatch(s)
	if len(finded) == 0 {
		if locale == "ko" {
			return "캐스퐁"
		}
		return "Normal"
	}
	return strings.TrimSpace(strings.TrimRight(strings.TrimRight(finded[1], "의 모습"), "Form"))
}

func getFormFromTitle(s string, locale string) string {
	fields := strings.Split(s, "-")
	if len(fields) == 1 {
		if locale == "ko" {
			return "캐스퐁"
		}
		return "Normal"
	}
	return strings.TrimSpace(strings.TrimRight(strings.TrimRight(strings.TrimSpace(fields[1]), "의 모습"), "Form"))
}

func trimName(s string) string {
	return strings.Fields(s)[0]
}

func getImageURL(doc *goquery.Document) string {
	switch {
	case doc.Find(`article.forms-block div.forms a.form`).Length() >= 2:
		return `https://pokemon.gameinfo.io` + doc.Find(`article.forms-block div.forms a.form.active img`).AttrOr(`src`, ``)
	case doc.Find(`article.images-block img`).Length() > 0:
		return `https://pokemon.gameinfo.io` + doc.Find(`article.images-block img`).First().AttrOr(`src`, ``)
	default:
		return ""
	}
}
