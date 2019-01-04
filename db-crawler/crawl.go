package main

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/grengojbo/goquery"
)

func crawl() {
	wg := sync.WaitGroup{}
	for code := 1; code <= 493; code++ {
		wg.Add(1)
		go fetch(&wg, code)
	}
	wg.Wait()
}

func fetch(wg *sync.WaitGroup, code int) {
	defer wg.Done()

	url := fmt.Sprintf("https://pokemon.gameinfo.io/ko/pokemon/%v", code)
	doc, err := goquery.NewDocument(url)
	if err != nil {
		panic(err)
	}

	html, err := doc.Html()
	if err != nil {
		panic(err)
	}

	filename, err := filepath.Abs(fmt.Sprintf("./raws/%v.html", code))
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

			filename, err := filepath.Abs(fmt.Sprintf("./raws/%v_%v.html", code, form))
			if err != nil {
				panic(err)
			}

			if err := ioutil.WriteFile(filename, []byte(html), os.ModePerm); err != nil {
				panic(err)
			}
		})
	}
}
