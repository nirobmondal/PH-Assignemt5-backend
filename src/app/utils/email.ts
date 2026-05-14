import ejs from "ejs";
import status from "http-status";
import nodemailer from "nodemailer";
import path from "path";
import { envVars } from "../config/env";
import AppError from "../errorHelpers/AppError";
// logger ইম্পোর্ট সরিয়ে দেওয়া হয়েছে

const transporter = nodemailer.createTransport({
  host: envVars.EMAIL_SENDER.SMTP_HOST,
  secure: Number(envVars.EMAIL_SENDER.SMTP_PORT) === 465,
  auth: {
    user: envVars.EMAIL_SENDER.SMTP_USER,
    pass: envVars.EMAIL_SENDER.SMTP_PASS,
  },
  port: Number(envVars.EMAIL_SENDER.SMTP_PORT),
});

transporter.verify((error) => {
  console.log("host:", envVars.EMAIL_SENDER.SMTP_HOST);
  console.log("port:", envVars.EMAIL_SENDER.SMTP_PORT);
  console.log("user:", envVars.EMAIL_SENDER.SMTP_USER);
  console.log("from:", envVars.EMAIL_SENDER.SMTP_FROM);
  console.log("pass:", envVars.EMAIL_SENDER.SMTP_PASS);

  if (error) {
    // Render এ প্রাথমিক কানেকশন এরর দেখার জন্য
    console.error("❌ Nodemailer config error [Verification Failed]:", error);
  } else {
    console.log("✅ Nodemailer is ready to send emails");
  }
});

interface SendEmailOptions {
  to: string;
  subject: string;
  templateName: string;
  templateData: Record<string, unknown>;
  attachments?: Array<{
    filename: string;
    content?: Buffer | string;
    contentType?: string;
    path?: string;
  }>;
}

export const sendEmail = async ({
  subject,
  templateData,
  templateName,
  to,
  attachments,
}: SendEmailOptions) => {
  const templatePath = path.resolve(
    process.cwd(),
    `src/app/templates/${templateName}.ejs`,
  );

  try {
    const html = await ejs.renderFile(templatePath, templateData);

    const info = await transporter.sendMail({
      from: envVars.EMAIL_SENDER.SMTP_FROM,
      to: to,
      subject: subject,
      html: html,
      attachments: attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
        path: attachment.path,
      })),
    });

    console.log("✅ Email sent successfully:", {
      to,
      subject,
      templateName,
      messageId: info.messageId,
    });
  } catch (error) {
    // Render লগে বিস্তারিত এরর দেখার জন্য ফোকাসড কনসোল লগ
    console.error("================ EMAIL SENDING FAILED ================");
    console.error("To:", to);
    console.error("Subject:", subject);
    console.error("Template:", templateName);
    console.error("❌ Detailed Error Object:", error);
    if (error instanceof Error) {
      console.error("Error Message:", error.message);
      console.error("Error Stack:", error.stack);
    }
    console.error("======================================================");

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to send email");
  }
};
