package main

import (
	"fmt"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

var 도감URLs = []string{
	`https://pokemon.fandom.com/ko/wiki/전국도감/1세대`,
	`https://pokemon.fandom.com/ko/wiki/전국도감/2세대`,
	`https://pokemon.fandom.com/ko/wiki/전국도감/3세대`,
	`https://pokemon.fandom.com/ko/wiki/전국도감/4세대`,
	`https://pokemon.fandom.com/ko/wiki/전국도감/5세대`,
	`https://pokemon.fandom.com/ko/wiki/전국도감/6세대`,
}

func main() {
	for _, url := range 도감URLs {
		doc, err := goquery.NewDocument(url)
		if err != nil {
			panic(err)
		}

		trs := doc.Find(`#mw-content-text > table > tbody > tr.bg-white`)
		trs.Each(func(i int, s *goquery.Selection) {
			a := s.Find(`td:nth-child(4) > a`).First()
			name := strings.TrimSpace(a.Text())
			href, _ := a.Attr(`href`)
			subdoc, err := goquery.NewDocument("https://pokemon.fandom.com" + href)
			if err != nil {
				panic(err)
			}
			classify := strings.TrimSpace(subdoc.Find(`div#WikiaArticle table > tbody > tr:nth-child(2) > td:nth-child(2)`).First().Text())

			fmt.Println(name, classify)
		})
	}
}
