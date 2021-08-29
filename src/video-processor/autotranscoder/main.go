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


const (
    location = "us-central1"
    projectID = "droplet-measurement-309203"
    targetBucket = "droplet-measurement-processed-public"
)


type ProcessVideoRequest struct {
    SourceBucket string
    SourceVideoPath string
    TargetWidth int32
    TargetHeight int32
    StartTimeOffsetSeconds int64
    IntervalSeconds int64
}

type ProcessVideoResponse struct {
    JobName string
    TargetBucket string
    TargetDirPath string
}


func processVideo(inputURI, outputURI string,
                  width, height int32,
                  startTimeOffset, interval duration.Duration) (string, error) {
    log.Printf("Creating job...")
    outputName := strings.Split(path.Base(inputURI), ".")[0]
    ctx := context.Background()
    client, err := transcoder.NewClient(ctx)
    if err != nil {
        return "", fmt.Errorf("NewClient error: %v", err)
    }
    defer client.Close()

    // https://cloud.google.com/transcoder/docs/concepts/config-examples
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
                            SpriteWidthPixels: width,
                            SpriteHeightPixels: height,
                            StartTimeOffset: &startTimeOffset,
                            ExtractionStrategy: &transcoderpb.SpriteSheet_Interval{
                                Interval: &interval,
                            },
                        },
                    },
                    Output: &transcoderpb.Output {
                        Uri: outputURI,
                    },
                },
            },
        },
    }

    log.Printf("Submitting job...")
    response, err := client.CreateJob(ctx, req)
    if err != nil {
        return "", fmt.Errorf("createJob error: %v", err)
    }

    log.Printf("Job: %v", response)
    log.Printf("Job name: %v", response.GetName())
    return response.GetName(), nil
}

func HandleRequest(w http.ResponseWriter, r *http.Request) {
    log.Printf("Running HandleRequest...")
    var req ProcessVideoRequest
    body, err := ioutil.ReadAll(r.Body)
    if err != nil {
        log.Printf("ioutil.ReadAll: %v", err)
        http.Error(w, fmt.Sprintf("Bad Request: %v", err), http.StatusBadRequest)
        return
    }
    log.Printf("Request body: %s", body)
    if err := json.Unmarshal(body, &req); err != nil {
        log.Printf("json.Unmarshal: %v", err)
        http.Error(w, fmt.Sprintf("Bad Request: %v", err), http.StatusBadRequest)
        return
    }

    log.Printf("Request: %s", req)

    inputURI := fmt.Sprintf("gs://%s/%s", req.SourceBucket, req.SourceVideoPath)
    outputName := strings.Split(path.Base(req.SourceVideoPath), ".")[0]
    targetDirPath := fmt.Sprintf("processed/%s/", outputName)
    outputURI := fmt.Sprintf("gs://%s/%s", targetBucket, targetDirPath)
    log.Printf("inputURI: %s || outputURI: %s || targetDirPath: %s", inputURI, outputURI, targetDirPath)

    // jobName := ""
    jobName, err := processVideo(
        inputURI, outputURI, req.TargetWidth, req.TargetHeight,
        duration.Duration{Seconds: req.StartTimeOffsetSeconds},
        duration.Duration{Seconds: req.IntervalSeconds})
    if err != nil {
        log.Printf("Error creating job: %v", err)
    }

    resp := ProcessVideoResponse{
        JobName: jobName,
        TargetBucket: targetBucket,
        TargetDirPath: targetDirPath,
    }

    jsonResp, err := json.Marshal(resp)
    if err != nil {
        log.Printf("json.Marshal: %v", err)
        http.Error(w, fmt.Sprintf("Bad Request: %v", err), http.StatusBadRequest)
        return
    }
    w.Header().Set("Content-Type", "application/json; charset=utf-8")
    fmt.Fprintf(w, string(jsonResp))
}

func main() {
    http.HandleFunc("/", HandleRequest)
    port := os.Getenv("PORT")
    if port == "" {
            port = "8080"
            log.Printf("Defaulting to port %s", port)
    }
    log.Printf("Listening on port %s", port)
    if err := http.ListenAndServe(":"+port, nil); err != nil {
            log.Fatal(err)
    }
}
