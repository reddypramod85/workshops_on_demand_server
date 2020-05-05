import cron from "cron";
import models from "../../models";
import createEmailBody from "../Email/createEmailBody";
import sendEmail from "../Email";
import dotenv from "dotenv";

dotenv.config();

const { CronJob } = cron;

const getHoursLeft = ends => {
  const oneHour = 1 * 60 * 60 * 1000;
  const endsDate = new Date(ends);
  const today = new Date();
  return Math.round((endsDate.getTime() - today.getTime()) / oneHour);
};

const getDates = () => {
  const startDate = new Date();
  const endDate = new Date();
  // const addHours = process.env.WORKSHOP_DURATION;
  endDate.setHours(endDate.getHours() + 4);
  return { startDate, endDate };
};

/* Function to generate combination of password */

const generatePassword = () => {
  var pass = "";
  var str =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ" + "abcdefghijklmnopqrstuvwxyz0123456789@#$";

  for (let i = 1; i <= 8; i++) {
    var char = Math.floor(Math.random() * str.length + 1);

    pass += str.charAt(char);
  }

  return pass;
};

export const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const checkCustomer = () => {
  models.customer
    .findAll({ include: [{ all: true, nested: true }] })
    .then(customers =>
      customers.map(async customer => {
        // eslint-disable-line array-callback-return
        const { dataValues } = customer;
        const customerStatus = dataValues.active;
        //const updated = dataValues.upupdatedAt.getHours();
        const hoursLeft = getHoursLeft(dataValues.endDate);

        // Send welcome email.
        if (!dataValues.lastEmailSent && dataValues.studentId != null) {
          console.log("send welcome email");
          return sendEmail({
            recipient: dataValues.email,
            subject: "Welcome to HPE Workshops On Demand",
            content: createEmailBody({
              heading: "Welcome to HPE Workshops On Demand!",
              content: `
                Hi ${dataValues.name},</br>
                Your request for the <b>${dataValues.workshop}</b> workshop has been received. We will send you the access details soon in a seperate email.</br>
                
                <b>NOTE:</b> Your wokshop access will be expired in ${dataValues.hours} hours after you receive your credentials.</br>
               
                </br></br>
              `
            })
          }).then(() => {
            customer.update({
              lastEmailSent: "welcome"
            });
          });
        }

        // Send workshop credentilas as soon as there are ready.
        if (customerStatus && dataValues.lastEmailSent === "welcome") {
          // fetch the customer requested workshop from workshops table
          const workshop = await models.workshop.findOne({
            where: { name: dataValues.workshop }
          });
          console.log("send workshops credentials email");
          return sendEmail({
            recipient: dataValues.email,
            subject: "Your HPE Workshops On Demand credentials",
            content: createEmailBody({
              heading: "Your HPE Workshops On Demand credentials",
              content: `Your <b>${dataValues.workshop}</b> workshop credentials along with the video link are provided below to follow along the workshop. Your access to the workshop will end in ${dataValues.hours} hours from now.`,
              buttonLabel: "Start Workshop",
              buttonUrl: dataValues.student.url,
              userName: dataValues.student.username,
              password: dataValues.student.password,
              videoUrl: `${workshop.replayAvailable}` ? workshop.videoUrl : ""
            })
          }).then(() => {
            customer.update({
              lastEmailSent: "credentials",
              ...getDates()
            });
          });
        }

        // Send expired email.
        if (hoursLeft <= 0 && dataValues.lastEmailSent === "credentials") {
          console.log("send expired email");
          return sendEmail({
            recipient: dataValues.email,
            subject: "Your HPE Workshops On Demand trial has ended",
            content: createEmailBody({
              heading: "Thanks for trying HPE Workshops On Demand!",
              content: `We hope you enjoyed <b>${dataValues.workshop}<b> Workshop On Demand trial.`,
              buttonLabel: "Click here to Provide the Feedback",
              buttonUrl:
                "https://forms.office.com/Pages/ResponsePage.aspx?id=YSBbEGm2MUuSrCTTBNGV3KiKnXK8thhKg7iBfJh46UlUQzFEUUVGMVVQMEowMElUMVY3WkVUU0pWVi4u"
            })
          }).then(() => {
            customer.update({
              lastEmailSent: "expired",
              active: false
            });
            customer.student.update({
              assigned: false,
              password: generatePassword()
            });
          });
        }
        return undefined;
      })
    );
};

const runCronJobs = () => {
  const jobToCheckCustomers = new CronJob({
    // cronTime: '00 00 * * * *', // every hour
    cronTime: "*/20 * * * * *", // every 20 seconds
    // onTick: checkCustomer(),
    onTick: () => checkCustomer(),
    runOnInit: true
  });

  jobToCheckCustomers.start();
};

export default runCronJobs;