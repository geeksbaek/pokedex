package main

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"sync"

	"github.com/grengojbo/goquery"
)

func crawl() {
	wg := sync.WaitGroup{}
	wg.Add(386)
	for code := 1; code <= 386; code++ {
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
		url := fmt.Sprintf("https://pokemon.gameinfo.io/ko/pokemon/%v/alola-form", code)
		doc, err := goquery.NewDocument(url)
		if err != nil {
			panic(err)
		}

		html, err := doc.Html()
		if err != nil {
			panic(err)
		}

		filename, err := filepath.Abs(fmt.Sprintf("./raws/%v_alola.html", code))
		if err != nil {
			panic(err)
		}

		if err := ioutil.WriteFile(filename, []byte(html), os.ModePerm); err != nil {
			panic(err)
		}
	}
}
