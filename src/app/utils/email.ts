import ejs from "ejs";
import path from "path";
import sgMail from "@sendgrid/mail";
import status from "http-status";

import AppError from "../errorHelpers/AppError";
import { envVars } from "../config/env";

// ======================================================
// SENDGRID CONFIG
// ======================================================

sgMail.setApiKey(envVars.SENDGRID_API_KEY);

// ======================================================
// TYPES
// ======================================================

interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  templateName: string;
  templateData: Record<string, unknown>;
  attachments?: EmailAttachment[];
}

// ======================================================
// SEND EMAIL FUNCTION
// ======================================================

export const sendEmail = async ({
  to,
  subject,
  templateName,
  templateData,
  attachments,
}: SendEmailOptions) => {
  try {
    // ======================================================
    // TEMPLATE PATH
    // ======================================================

    const templatePath = path.resolve(
      process.cwd(),
      `src/app/templates/${templateName}.ejs`,
    );

    // ======================================================
    // RENDER EJS TEMPLATE
    // ======================================================

    const html = await ejs.renderFile(templatePath, templateData);

    // ======================================================
    // SEND EMAIL
    // ======================================================

    const response = await sgMail.send({
      to,
      from: envVars.SENDGRID_FROM_EMAIL,
      subject,

      // HTML EMAIL
      html,

      // TEXT FALLBACK
      text: subject,

      // ATTACHMENTS
      attachments: attachments?.map((attachment) => ({
        filename: attachment.filename,

        // SENDGRID expects BASE64 STRING
        content: attachment.content.toString("base64"),

        type: attachment.contentType,

        disposition: "attachment",
      })),

      // OPTIONAL CATEGORY
      categories: [templateName],
    });

    // ======================================================
    // SUCCESS LOG
    // ======================================================

    console.log("✅ Email sent successfully:", {
      to,
      subject,
      templateName,
      statusCode: response[0]?.statusCode,
      headers: response[0]?.headers,
    });

    return response;
  } catch (error: any) {
    // ======================================================
    // ERROR LOGGING
    // ======================================================

    console.error("================ EMAIL SENDING FAILED ================");

    console.error("To:", to);
    console.error("Subject:", subject);
    console.error("Template:", templateName);

    if (error?.response?.body) {
      console.error(
        "SendGrid Response Error:",
        JSON.stringify(error.response.body, null, 2),
      );
    }

    console.error("Detailed Error:", error);

    console.error("======================================================");

    // ======================================================
    // THROW APP ERROR
    // ======================================================

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to send email");
  }
};
