# Cloud Run - https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloud_run_service

terraform {
    required_providers {
        google = {
            source = "hashicorp/google"
            version = "3.82.0"
        }
    }
}

provider "google" {
    credentials = file("droplet-measurement-a396a-0d86c4b0cdb3.json")

    project = "droplet-measurement-a396a"
    region  = "us-east1"
}

resource "google_storage_bucket" "droplet_measure_public" {
    name          = "droplet-measure-public"
    location      = "us-east1"
    force_destroy = true

    uniform_bucket_level_access = true

    cors {
        origin          = ["*"]
        method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
        response_header = ["Content-Type"]
        max_age_seconds = 10
    }
}

resource "google_cloud_run_service" "autotranscoder" {
    name     = "autotranscoder"
    location = "us-east1"

    template {
        spec {
            containers {
                image = "gcr.io/droplet-measurement-a396a/autotranscoder"
            }
            container_concurrency = "5"
        }
        metadata {
            annotations = {
                "autoscaling.knative.dev/maxScale" = "1"
            }
        }
    }

    traffic {
        percent         = 100
        latest_revision = true
    }
}

resource "google_cloud_run_service" "droplet_detector" {
    name     = "droplet-detector"
    location = "us-east1"

    template {
        spec {
            containers {
                image = "gcr.io/droplet-measurement-a396a/droplet-detector"
                resources {
                    limits = {
                        memory = "2Gi"
                    }
                }
            }
            container_concurrency = "5"
        }
        metadata {
            annotations = {
                "autoscaling.knative.dev/maxScale" = "1"
            }
        }
    }

    traffic {
        percent         = 100
        latest_revision = true
    }
}

resource "google_project_service" "workflows" {
  service            = "workflows.googleapis.com"
  disable_on_destroy = false
}

resource "google_service_account" "workflows_service_account" {
    account_id   = "workflows-service-account"
    display_name = "Workflows Service Account"
}

resource "google_workflows_workflow" "video_processor" {
    name            = "video-processor"
    region          = "us-east1"
    service_account = google_service_account.workflows_service_account.id
    source_contents = file("${path.module}/src/video-processor/workflow.yaml")
    depends_on = [google_project_service.workflows]
}
