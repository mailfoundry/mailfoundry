import {
  SESv2Client,
  SendEmailCommand,
} from "@aws-sdk/client-sesv2";

const sesClient = new SESv2Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: SendEmailInput) {
  const fromEmail = process.env.SES_FROM_EMAIL;

  if (!fromEmail) {
    throw new Error("SES_FROM_EMAIL is not set in .env");
  }

  const command = new SendEmailCommand({
    FromEmailAddress: fromEmail,
    ConfigurationSetName: "mailfoundry",
    Destination: {
      ToAddresses: [to],
    },
    Content: {
      Simple: {
        Subject: {
          Data: subject,
        },
        Body: {
          Text: {
            Data: text,
          },
          Html: {
            Data: html ?? text.replace(/\n/g, "<br />"),
          },
        },
      },
    },
  });

  return sesClient.send(command);
}