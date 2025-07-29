/**
* Import function triggers from their respective submodules:
*
* import {onCall} from "firebase-functions/v2/https";
* import {onDocumentWritten} from "firebase-functions/v2/firestore";
*
* See a full list of supported triggers at https://firebase.google.com/docs/functions
*/

// import {onRequest} from "firebase-functions/v2/https";
// import * as logger from "firebase-functions/logger";

import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { CallableRequest, onCall, onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import axios from "axios";
import Razorpay from "razorpay";
import {validatePaymentVerification} from "razorpay/dist/utils/razorpay-utils";

const keyId = defineSecret("RAZORPAY_KEY_ID");
const keySecret = defineSecret("RAZORPAY_KEY_SECRET");
const botToken = defineSecret("TELEGRAM_TOKEN");
const chatId = defineSecret("TELEGRAM_CHAT_ID");
const db = getFirestore();

export const createStarStoreOrder = onCall({
	cors: ["http://localhost", "https://jailson300.github.io", "https://star-store.web.app", "*"],
	secrets: [keyId, keySecret],
}, async (request) => {
	const instance = new Razorpay({
		key_id: keyId.value(),
		key_secret: keySecret.value(),
	});
	const options = {
		amount: request.data.amount,
		currency: "INR",
	};

	try {
		const order = await new Promise((resolve, reject) => {
			instance.orders.create(options, (err, order) => {
				if (err) {
					console.log(err);
					reject(err);
				}
				resolve(order);
			});
		});
		return order;
	} catch (error) {
		console.log(error);
		return error;
	}
})

export const sendOrderNotification = onCall({
	cors: ["http://localhost", "https://jailson300.github.io", "https://star-store.web.app", "*"],
	secrets: [keySecret, botToken, chatId],
}, async (request: CallableRequest<any>) => {
	console.log(request.data);
	if (!keySecret || !botToken || !chatId) {
		console.error("Missing environment variables");
		return {
			success: false,
			message: "Missing environment variables",
		};
	}
	if (validatePaymentVerification({
		"order_id": request.data.razorpay_order_id,
		"payment_id": request.data.razorpay_payment_id,
	}, request.data.razorpay_signature, keySecret.value()) == false) {
		console.log("Payment verification failed");
		return {
			success: false,
			message: "Payment verification failed! Please copy your order ID and contact the administrators immediately!",
			order_id: request.data.razorpay_order_id,
		};
	}

	const url = `https://api.telegram.org/bot${botToken.value()}/sendMessage`;
	const orderId = (request.data.razorpay_order_id);
	const paymentId = (request.data.razorpay_payment_id);
	const name = (request.data.name);
	const userId = (request.data.id);
	const server = (request.data.server);
	const packageName = (request.data.package);
	const cost = (request.data.cost);
	const userAuthId = (request.data.uuid);

	const message = `
*New Order Placed!* 🔥

*Order Details:*
		- Order ID: \`${orderId}\`
		- Payment ID: \`${paymentId}\`

*User Details:*
		- Name: ${name}
		- User ID: \`${userId}\`
		- Server: \`${server}\`

*Package Details:*
		- Package: ${packageName}
		- Cost: ${cost}
	`;

	try {
		// First add to cloud firestore
		const data = {
			order_id: request.data.razorpay_order_id,
			payment_id: request.data.razorpay_payment_id,
			name: request.data.name,
			id: request.data.id,
			server: request.data.server,
			package: request.data.package,
			cost: request.data.cost,
			status: "pending",
			uuid: userAuthId,
			timestamp: FieldValue.serverTimestamp(),
		}
		const firestoreRes = await db.collection("tenants").doc("star-store").collection("orders").doc(request.data.razorpay_order_id).set(data);

		if (!firestoreRes) {
			console.error("Error adding to firestore:", firestoreRes);
			return {
				success: true,
				message: "Payment verified, but not added to the database. Please copy your order ID and contact the administrators immediately!",
				order_id: request.data.razorpay_order_id,
			};
		}

		const response = await axios.post(url, {
			chat_id: chatId.value(),
			text: message,
			parse_mode: "Markdown",
			reply_markup: {
				inline_keyboard: [
					[
						{ text: "✅ Done", callback_data: `confirm-${orderId}` },
						{ text: "❌ Reject", callback_data: `reject-${orderId}` },
					]
				]
			}
		})

		const resData = await response.data;
		if (!resData.ok) {
			console.error("Error sending message:", resData.description);
			return {
				success: true,
				message: "Payment verified, but unable to notify the administrators. Please copy your order ID and contact them immediately!",
				order_id: request.data.razorpay_order_id,
			};
		}

		return {
			success: true,
			message: "Payment verified!! Copy the order ID",
			...data
		};
	} catch (error) {
		console.error("Error sending message:", error);
		return {
			success: false,
			message: "Payment verified, but unable to notify the administrators",
			order_id: request.data.razorpay_order_id,
		};
	}
})

export const recieveTelegramCallback = onRequest({
	cors: ["http://localhost", "https://jailson300.github.io", "https://star-store.web.app", "*"],
	secrets: [botToken, chatId],
}, async (req, res) => {
	if (!botToken || !chatId) {
		console.error("Missing environment variables");
		res.status(200).send("Missing environment variables");
		return;
	}

	if (!req.body) {
		console.error("Missing request body");
		res.status(200).send("Missing request body");
		return;
	}

	const data = req.body;
	if (!data.callback_query) {
		console.error("Not a callback query");
		res.status(200).send("Not a callback query");
		return;
	}
	const recievedInfo = data.callback_query.data;
	if (!data.callback_query.message) {
		console.error("Missing message id");
		res.status(200).send("Missing message id");
		return;
	}
	const messageId = data.callback_query.message.message_id;
	const confirmOrReject = recievedInfo.split("-")[0];
	const orderId = recievedInfo.split("-")[1];

	// Get the firestore document in order to craft a proper response
	const docRef = db.collection("tenants").doc("star-store").collection("orders").doc(orderId);
	const docSnap = await docRef.get();
	if (!docSnap.exists) {
		console.error("No such document!");
		res.status(200).send("OK");
		return;
	}

	const firestoreData = docSnap.data();
	if (!firestoreData) {
		console.error("No such document!");
		res.status(200).send("OK");
		return;
	}

	const paymentId = firestoreData.payment_id;
	const name = firestoreData.name;
	const userId = firestoreData.id;
	const server = firestoreData.server;
	const packageName = firestoreData.package;
	const cost = firestoreData.cost;
	const message = `
*New Order Placed!* 🔥

*Order Details:*
		- Order ID: \`${orderId}\`
		- Payment ID: \`${paymentId}\`

*User Details:*
		- Name: ${name}
		- User ID: \`${userId}\`
		- Server: \`${server}\`

*Package Details:*
		- Package: ${packageName}
		- Cost: ${cost}
	`;

	if (confirmOrReject == "confirm") {
		db.collection("tenants").doc("star-store").collection("orders").doc(orderId).update({
			status: "done"
		}).then(() => {
			const updateTextUrl = `https://api.telegram.org/bot${botToken.value()}/editMessageText`;
			const messageToSend = message.replace("*New Order Placed!* 🔥", "*Order Delivered!* 🔥");
			axios.post(updateTextUrl, {
				chat_id: chatId.value(),
				message_id: messageId,
				text: messageToSend,
				parse_mode: "Markdown",
			})
		})
	} else if (confirmOrReject == "reject") {
		db.collection("tenants").doc("star-store").collection("orders").doc(orderId).update({
			status: "rejected"
		}).then(() => {
			const updateTextUrl = `https://api.telegram.org/bot${botToken.value()}/editMessageText`;
			const messageToSend = message.replace("*New Order Placed!* 🔥", "*Order Rejected*");
			axios.post(updateTextUrl, {
				chat_id: chatId.value(),
				message_id: messageId,
				text: messageToSend,
				parse_mode: "Markdown",
			})
		})
	} else {
		res.status(200).send("OK");
	}

	// return a valid response http 200
	res.status(200).send("OK");
})

export const telegramWebhookForwarder = onRequest({
	cors: ["http://localhost", "https://jailson300.github.io", "https://star-store.web.app", "*"],
}, async (req, res) => {
	const prodUrl = "https://us-central1-winter-f3cb5.cloudfunctions.net/recieveTelegramCallback";
	const devUrl = "https://aware-thoroughly-goldfish.ngrok-free.app/winter-f3cb5/us-central1/recieveTelegramCallback";

	const prodPromise = await axios.post(prodUrl, req.body);
	const devPromise = await axios.post(devUrl, req.body);

	Promise.allSettled([prodPromise, devPromise])

	res.status(200).send("OK");
})

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
