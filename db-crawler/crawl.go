package main

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	"github.com/PuerkitoBio/goquery"
)

var reIDAndForm = regexp.MustCompile(`var pokemon = { id: (\d+), name: '.*', stats: .*, form: (\d+) };`)

func crawl(locale string) {
	wg := sync.WaitGroup{}
	for code := 1; code <= 649; code++ {
		wg.Add(1)
		go fetch(&wg, code, locale)

		if code%100 == 0 {
			wg.Wait()
		}
	}

	// 멜탄
	wg.Add(1)
	go fetch(&wg, 808, locale)

	// 멜메탈
	wg.Add(1)
	go fetch(&wg, 809, locale)

	wg.Wait()
}

func fetch(wg *sync.WaitGroup, code int, locale string) {
	defer wg.Done()

	url := fmt.Sprintf("https://pokemon.gameinfo.io/"+locale+"/pokemon/%v", code)
	doc, err := goquery.NewDocument(url)
	if err != nil {
		panic(err)
	}

	html, err := doc.Html()
	if err != nil {
		panic(err)
	}

	filename, err := filepath.Abs(fmt.Sprintf("./raws/"+locale+"/%v.html", code))
	if err != nil {
		panic(err)
	}

	if err := ioutil.WriteFile(filename, []byte(html), os.ModePerm); err != nil {
		panic(err)
	}

	if doc.Find(`.forms-block .forms a`).Length() > 1 {
		doc.Find(`.forms-block .forms a:not(:first-child)`).Each(func(i int, s *goquery.Selection) {
			url, exists := s.Attr(`href`)
			if !exists {
				panic("not exist")
			}

			doc, err := goquery.NewDocument("https://pokemon.gameinfo.io" + url)
			if err != nil {
				panic(err)
			}

			html, err := doc.Html()
			if err != nil {
				panic(err)
			}

			tmp := strings.Split(url, "/")
			form := tmp[len(tmp)-1]

			if form == "purified" || form == "shadow" {
				return
			}

			filename, err := filepath.Abs(fmt.Sprintf("./raws/"+locale+"/%v_%v.html", code, form))
			if err != nil {
				panic(err)
			}

			if err := ioutil.WriteFile(filename, []byte(html), os.ModePerm); err != nil {
				panic(err)
			}
		})
	}
}

// TODO.
// 미리 fetch하여 파일로 기록해두도록 수정할 것
func fetchClassify(pokemonName string, locale string) string {
	if classify, ok := classifyMap[pokemonName]; ok {
		return classify
	}

	doc, err := goquery.NewDocument(fmt.Sprintf("https://pokemon.fandom.com/"+locale+"/wiki/%v", pokemonName))
	if err != nil {
		return ""
	}

	return strings.TrimSpace(doc.Find("div.infobox-pokemon > table > tbody > tr:nth-child(2) > td:nth-child(2)").First().Text())
}
