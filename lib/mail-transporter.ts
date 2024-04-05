import nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

let transporterInstance: nodemailer.Transporter<SMTPTransport.SentMessageInfo>;

function getTransport(): nodemailer.Transporter<SMTPTransport.SentMessageInfo> {
  if (!transporterInstance) {
    transporterInstance = nodemailer.createTransport({
      host: process.env.MAIL_OUTGOING_HOST,
      port: parseInt(process.env.MAIL_OUTGOING_PORT || '587', 10),
      secure: false,
      auth: {
        user: process.env.MAIL_OUTGOING_USER,
        pass: process.env.MAIL_OUTGOING_PASSWORD,
      },
    });
  }
  return transporterInstance;
}

let mailTransport = getTransport();

export { mailTransport };
