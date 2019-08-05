// Package p contains an HTTP Cloud Function.
package p

import (
	"log"
	"net/http"
	"os"

	"github.com/golang/protobuf/jsonpb"
	dialogflowpb "google.golang.org/genproto/googleapis/cloud/dialogflow/v2"
)

var projectID = os.Getenv("GCP_PROJECT")

// HelloWorld prints the JSON encoded "message" field in the body
// of the request or "Hello, World!" if there isn't one.
func HelloWorld(w http.ResponseWriter, r *http.Request) {
	wr := dialogflowpb.WebhookRequest{}
	if err := jsonpb.Unmarshal(r.Body, &wr); err != nil {
		log.Println("Couldn't Unmarshal request to jsonpb")
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	log.Printf("session: %v\n", wr.GetSession())

	w.Header().Add("Content-Type", "application/json")
	marshaler := jsonpb.Marshaler{}
	if err := marshaler.Marshal(w, &dialogflowpb.WebhookResponse{
		FulfillmentMessages: []*dialogflowpb.Intent_Message{
			&dialogflowpb.Intent_Message{
				Platform: dialogflowpb.Intent_Message_ACTIONS_ON_GOOGLE,
				Message: &dialogflowpb.Intent_Message_Text_{
					Text: &dialogflowpb.Intent_Message_Text{
						Text: []string{"Test Message"},
					},
				},
			},
			&dialogflowpb.Intent_Message{
				Platform: dialogflowpb.Intent_Message_ACTIONS_ON_GOOGLE,
				Message: &dialogflowpb.Intent_Message_Suggestions_{
					Suggestions: &dialogflowpb.Intent_Message_Suggestions{
						Suggestions: []*dialogflowpb.Intent_Message_Suggestion{
							&dialogflowpb.Intent_Message_Suggestion{
								Title: "테스트",
							},
						},
					},
				},
			},
		},
	}); err != nil {
		log.Fatal(err)
	}
}
