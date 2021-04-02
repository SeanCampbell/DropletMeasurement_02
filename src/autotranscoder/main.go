package main

import (
        "context"
        "encoding/json"
        "fmt"
        "io/ioutil"
        "log"
        "net/http"
        "os"

        transcoder "cloud.google.com/go/video/transcoder/apiv1beta1"
        transcoderpb "google.golang.org/genproto/googleapis/cloud/video/transcoder/v1beta1"
)

// https://cloud.google.com/transcoder/docs/concepts/config-examples
// {
//     "config": {
//       "inputs": [
//         {
//           "key": "input0",
//           "uri": "%s%s",
//         },
//       ],
//       "elementaryStreams": [
//         {
//           "videoStream": {
//             "bitrateBps": 500000,
//             "frameRate": 30,
//           },
//           "key": "video-stream0"
//         },
//       ],
//       "muxStreams": [
//         {
//           "key": "video-only-sd",
//           "container": "mp4",
//           "elementaryStreams": [
//             "video-stream0"
//           ]
//         },
//       ],
//       "output": {
//         "uri": "%s",
//       },
//     },
// }

type GCSEvent struct {
	Bucket string `json:"bucket"`
	Name   string `json:"name"`
}

// createJobFromPreset creates a job based on a given preset template. See
// https://cloud.google.com/transcoder/docs/how-to/jobs#create_jobs_presets
// for more information.
// func createJobFromPreset(projectID string, location string, inputURI string, outputURI string, preset string) error {
func createJobFromPreset(inputURI string) error {
        projectID := "droplet-measurement-309203"
        location := "us-central1"
        // inputURI := "gs://my-bucket/my-video-file"
        outputURI := "gs://droplet-measurement-processed-public/processed/"
        // preset := "preset/web-hd"
        ctx := context.Background()
        client, err := transcoder.NewClient(ctx)
        if err != nil {
                return fmt.Errorf("NewClient: %v", err)
        }
        defer client.Close()

        // Job: &transcoderpb.Job{
        //         InputUri:  inputURI,
        //         OutputUri: outputURI,
        //         JobConfig: &transcoderpb.Job_TemplateId{
        //                 TemplateId: preset,
        //         },
        // },
        req := &transcoderpb.CreateJobRequest{
                Parent: fmt.Sprintf("projects/%s/locations/%s", projectID, location),
                Job: &transcoderpb.Job{
                    JobConfig: &transcoderpb.Job_Config {
                        Config: &transcoderpb.JobConfig{
                            Inputs: []*transcoderpb.Input{{
                                Key: "input0",
                                Uri: inputURI,
                            }},
                            ElementaryStreams: []*transcoderpb.ElementaryStream{{
                                Key: "video-stream0",
                                ElementaryStream: &transcoderpb.ElementaryStream_VideoStream{
                                    VideoStream: &transcoderpb.VideoStream{
                                        BitrateBps: 500000,
                                        FrameRate: 30,
                                    },
                                },
                            }},
                            MuxStreams: []*transcoderpb.MuxStream{{
                                Key: "video-only-sd",
                                Container: "mp4",
                                ElementaryStreams: []string{"video-stream0"},
                            }},
                            Output: &transcoderpb.Output {
                                Uri: outputURI,
                            },
                        },
                    },
                },
        }
        // Creates the job, Jobs take a variable amount of time to run.
        // You can query for the job state.
        response, err := client.CreateJob(ctx, req)
        if err != nil {
                return fmt.Errorf("createJobFromPreset: %v", err)
        }

        log.Printf("Job: %v", response.GetName())
        return nil
}

// PubSubMessage is the payload of a Pub/Sub event.
// See the documentation for more details:
// https://cloud.google.com/pubsub/docs/reference/rest/v1/PubsubMessage
type PubSubMessage struct {
        Message struct {
                Data []byte `json:"data,omitempty"`
                ID   string `json:"id"`
        } `json:"message"`
        Subscription string `json:"subscription"`
}

// HelloPubSub receives and processes a Pub/Sub push message.
func HelloPubSub(w http.ResponseWriter, r *http.Request) {
        var m PubSubMessage
        body, err := ioutil.ReadAll(r.Body)
        if err != nil {
                log.Printf("ioutil.ReadAll: %v", err)
                http.Error(w, "Bad Request", http.StatusBadRequest)
                return
        }
        if err := json.Unmarshal(body, &m); err != nil {
                log.Printf("json.Unmarshal: %v", err)
                http.Error(w, "Bad Request", http.StatusBadRequest)
                return
        }

        var e GCSEvent
        if err := json.Unmarshal(m.Message.Data, &e); err != nil {
                log.Printf("json.Unmarshal: %v", err)
                http.Error(w, "Bad Request", http.StatusBadRequest)
                return
        }

        createJobFromPreset(fmt.Sprintf("gs://%s/%s", e.Bucket, e.Name))
        log.Printf("%v", e)
}

func main() {
        http.HandleFunc("/", HelloPubSub)
        // Determine port for HTTP service.
        port := os.Getenv("PORT")
        if port == "" {
                port = "8080"
                log.Printf("Defaulting to port %s", port)
        }
        // Start HTTP server.
        log.Printf("Listening on port %s", port)
        if err := http.ListenAndServe(":"+port, nil); err != nil {
                log.Fatal(err)
        }
}
