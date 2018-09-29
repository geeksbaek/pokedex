package main

import (
	"fmt"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

const postPageURL = `https://pokemongolive.com/ko/post/`
const dateForm = `2006년 1월 2일`

type Post struct {
	Date  time.Time `json:"date"`
	Title string    `json:"title"`
	URL   string    `json:"url"`
}

func main() {
	doc, err := goquery.NewDocument(postPageURL)
	if err != nil {
		panic(err)
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

	for _, v := range posts {
		fmt.Println(v)
	}
}
