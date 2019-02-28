package main

import (
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api"
)

var globalPosts = fetchPosts()

const pokemonGOPostURL = `https://pokemongolive.com/en/post/`

type Post struct {
	Subject string
	URL     string
}

func (p *Post) String() string {
	return fmt.Sprintf("%v\n%v", p.Subject, p.URL)
}

type Posts map[string]*Post

func (ps Posts) String() string {
	var ret string
	for _, post := range ps {
		ret += post.String() + "\n\n"
	}
	return ret
}

func (oldps Posts) Diff(newps Posts) (diffps Posts) {
	diffps = Posts{}
	for k, newp := range newps {
		if _, exist := oldps[k]; !exist {
			diffps[k] = newp
		}
		oldps[k] = newp
	}
	return diffps
}

func main() {
	ticker := time.Tick(time.Second * 10)
	for range ticker {
		go task()
	}
}

func task() {
	diffPosts := globalPosts.Diff(fetchPosts())

	go notify(diffPosts)

	for k, post := range diffPosts {
		log.Printf("new notice: %v", post.Subject)
		globalPosts[k] = post
	}
}

func notify(ps Posts) error {
	log.Println("notify started")
	defer log.Println("notify ended")

	bot, err := tgbotapi.NewBotAPI(os.Getenv("TELEGRAM_TOKEN"))
	if err != nil {
		log.Println(err)
		return err
	}

	for _, p := range ps {
		msg := tgbotapi.NewMessageToChannel("@"+os.Getenv("TELEGRAM_CHANNEL_USERNAME"), p.String())
		if _, err := bot.Send(msg); err != nil {
			log.Println(err)
			return err
		}
	}

	return nil
}

func fetchPosts() (_posts Posts) {
	_posts = Posts{}

	doc, err := goquery.NewDocument(pokemonGOPostURL)
	if err != nil {
		log.Println(err)
		return
	}

	list := doc.Find(`div.grid.grid--padded.post-list div.post-list__title a`)
	list.Each(func(i int, s *goquery.Selection) {
		url := buildPostURL(s.AttrOr("href", ""))
		_posts[url] = &Post{
			Subject: strings.TrimSpace(s.Text()),
			URL:     url,
		}
	})

	return
}

func buildPostURL(url string) string {
	url = `https://pokemongolive.com` + url
	return strings.Replace(url, "/en/", "/ko/", 1)
}
