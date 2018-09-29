package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/jasonlvhit/gocron"
	"github.com/julienschmidt/httprouter"
)

const (
	postPageURL = `https://pokemongolive.com/ko/post/`
	dateForm    = `2006년 1월 2일`
	outputPath  = `./posts.json`
)

type Post struct {
	Date  time.Time `json:"date"`
	Title string    `json:"title"`
	URL   string    `json:"url"`
}

func main() {
	fetchPost()

	gocron.Every(1).Hour().Do(fetchPost)
	<-gocron.Start()

	router := httprouter.New()
	router.GET("/posts", posts)

	log.Fatal(http.ListenAndServe(":80", router))
}

func posts(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	f, err := os.Open(outputPath)
	if err != nil {
		log.Println(err)
		fmt.Fprintf(w, err.Error())
		return
	}
	if err := json.NewDecoder(f).Decode(w); err != nil {
		log.Println(err)
	}
}

func fetchPost() {
	doc, err := goquery.NewDocument(postPageURL)
	if err != nil {
		log.Println(err)
		return
	}

	posts := []*Post{}
	doc.Find(`.post-list div.post-list__date-item`).Each(func(i int, s *goquery.Selection) {
		date, _ := time.Parse(dateForm, strings.TrimSpace(s.Find(`span.post-list__date`).Text()))

		anchor := s.Next().Find(`a`)
		title := strings.TrimSpace(anchor.Text())
		link := `https://pokemongolive.com` + anchor.AttrOr("href", "")

		posts = append(posts, &Post{
			Date:  date,
			Title: title,
			URL:   link,
		})
	})

	if len(posts) == 0 {
		log.Println("empty posts")
		return
	}

	f, err := os.OpenFile(outputPath, os.O_RDWR|os.O_APPEND, 0660)
	if err != nil {
		log.Println(err)
		return
	}

	if err := json.NewEncoder(f).Encode(posts); err != nil {
		log.Println(err)
		return
	}

	log.Println("Write Succeed")
}
