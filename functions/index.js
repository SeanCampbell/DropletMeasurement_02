const {ExecutionsClient} = require("@google-cloud/workflows");
const functions = require("firebase-functions");
const cors = require("cors")({origin: true});

exports.main = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    functions.logger.info("Request:", request.body.data);
    const projectId = "droplet-measurement-a396a";
    const location = "us-central1";
    const workflowName = "video-processor";
    const client = new ExecutionsClient();
    client.createExecution({
      parent: client.workflowPath(projectId, location, workflowName),
      execution: {
        argument: JSON.stringify({
          sourceBucket: request.body.data.sourceBucket,
          sourceVideoPath: request.body.data.sourceVideoPath,
          targetWidth: request.body.data.targetWidth,
          targetHeight: request.body.data.targetHeight,
          startTimeOffsetSeconds: request.body.data.startTimeOffsetSeconds,
          intervalSeconds: request.body.data.intervalSeconds,
        }),
      },
    });
    response.status(200).json({data: "done"});
  });
});
