package main

import (
        "context"
        "encoding/json"
        "fmt"
        "io/ioutil"
        "log"
        "net/http"
        "os"
        "path"
        "strings"

        "github.com/golang/protobuf/ptypes/duration"
        transcoder "cloud.google.com/go/video/transcoder/apiv1beta1"
        transcoderpb "google.golang.org/genproto/googleapis/cloud/video/transcoder/v1beta1"
)



type GCSEvent struct {
	Bucket string `json:"bucket"`
	Name   string `json:"name"`
}

// createJobFromPreset creates a job based on a given preset template. See
// https://cloud.google.com/transcoder/docs/how-to/jobs#create_jobs_presets
// for more information.
// https://cloud.google.com/transcoder/docs/concepts/config-examples
// func createJobFromPreset(projectID string, location string, inputURI string, outputURI string, preset string) error {
func processVideo(inputURI string) error {
    log.Printf("Creating job...")
    projectID := "droplet-measurement-309203"
    location := "us-central1"
    // inputURI := "gs://my-bucket/my-video-file"
    outputName := strings.Split(path.Base(inputURI), ".")[0]
    outputURI := "gs://droplet-measurement-processed-public/processed/" + outputName + "/"
    // preset := "preset/web-hd"
    ctx := context.Background()
    client, err := transcoder.NewClient(ctx)
    if err != nil {
            return fmt.Errorf("NewClient error: %v", err)
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
                                    RateControlMode: "vbr",
                                    EnableTwoPass: true,
                                    CrfLevel: 10,
                                },
                            },
                        }},
                        MuxStreams: []*transcoderpb.MuxStream{{
                            Key: outputName,
                            Container: "mp4",
                            ElementaryStreams: []string{"video-stream0"},
                        }},
                        SpriteSheets: []*transcoderpb.SpriteSheet{
                            {
                                FilePrefix: "droplet-frame",
                                ColumnCount: 1,
                                RowCount: 1,
                                // TODO: Don't hardcode width, height, start time offset, or interval.
                                SpriteWidthPixels: 1952,
                                SpriteHeightPixels: 1952,
                                StartTimeOffset: &duration.Duration{
                                    Seconds: 180,
                                },
                                ExtractionStrategy: &transcoderpb.SpriteSheet_Interval{
                                    Interval: &duration.Duration{
                                        Seconds: 5,
                                    },
                                },

                            },
                        },
                        PubsubDestination: &transcoderpb.PubsubDestination{
                            Topic: "projects/droplet-measurement-309203/topics/videoProcessed",
                        },
                        Output: &transcoderpb.Output {
                            Uri: outputURI,
                        },
                    },
                },
            },
    }
    // Creates the job, Jobs take a variable amount of time to run.
    // You can query for the job state.
    log.Printf("Submitting job...")
    response, err := client.CreateJob(ctx, req)
    if err != nil {
            return fmt.Errorf("createJobFromPreset error: %v", err)
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

// HandleRequest receives and processes a Pub/Sub push message.
func HandleRequest(w http.ResponseWriter, r *http.Request) {
    log.Printf("Running HandleRequest...")
    var m PubSubMessage
    body, err := ioutil.ReadAll(r.Body)
    if err != nil {
            log.Printf("ioutil.ReadAll: %v", err)
            http.Error(w, "Bad Request", http.StatusBadRequest)
            return
    }
    log.Printf("Message body: %s", body)
    if err := json.Unmarshal(body, &m); err != nil {
            log.Printf("json.Unmarshal: %v", err)
            http.Error(w, "Bad Request", http.StatusBadRequest)
            return
    }

    log.Printf("Message data: %s", m.Message.Data)
    var e GCSEvent
    if err := json.Unmarshal(m.Message.Data, &e); err != nil {
            log.Printf("json.Unmarshal: %v", err)
            http.Error(w, "Bad Request", http.StatusBadRequest)
            return
    }

    log.Printf("Calling createJobFromPreset...")
    if err := processVideo(fmt.Sprintf("gs://%s/%s", e.Bucket, e.Name)); err != nil {
        log.Printf("Error creating job: %v", err)
    }
    log.Printf("event: %v", e)
}

func main() {
        http.HandleFunc("/", HandleRequest)
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
