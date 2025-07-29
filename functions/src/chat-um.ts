/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as logger from "firebase-functions/logger";
import { user } from "firebase-functions/v1/auth"

import { getFirestore } from "firebase-admin/firestore";

exports.userCreated = user().onCreate(async (user) => {
	logger.info("New user created", { })
	console.log(user.tenantId)
	const writeResult = await getFirestore().collection("tenants").doc(user.tenantId ?? "chat-um-bhulo").collection("users").doc(user.uid).set({
		uid: user.uid,
		email: user.email,
		photoURL: user.photoURL,
		displayName: user.displayName,
		phoneNumber: user.phoneNumber,
		status: 'online',
		createdAt: user.metadata.creationTime,
		updatedAt: user.metadata.lastSignInTime
	})
	if (!writeResult) {
		logger.error("Error creating user", {
			structuredData: true,
			uid: user.uid,
			email: user.email,
			photoURL: user.photoURL,
			displayName: user.displayName,
			phoneNumber: user.phoneNumber,
			status: 'online',
			createdAt: user.metadata.creationTime,
			updatedAt: user.metadata.lastSignInTime
		})
		return
	}
	logger.info("New user created", {
		structuredData: true,
		uid: user.uid,
		email: user.email,
		photoURL: user.photoURL,
		displayName: user.displayName,
		phoneNumber: user.phoneNumber,
		status: 'online',
		createdAt: user.metadata.creationTime,
		updatedAt: user.metadata.lastSignInTime
	})
})

exports.userDeleted = user().onDelete(async (user) => {
	logger.info("User deleted", { })
	const writeResult = await getFirestore().collection("tenants").doc(user.tenantId ?? "chat-um-bhulo").collection("users").doc(user.uid).delete()
	if (!writeResult) {
		logger.error("Error deleting user", {
			structuredData: true,
			uid: user.uid,
			email: user.email,
			photoURL: user.photoURL,
			displayName: user.displayName,
			phoneNumber: user.phoneNumber,
			status: 'online',
			createdAt: user.metadata.creationTime,
			updatedAt: user.metadata.lastSignInTime
		})
		return
	}
	logger.info("User deleted", {
		structuredData: true,
		uid: user.uid,
		email: user.email,
		photoURL: user.photoURL,
		displayName: user.displayName,
		phoneNumber: user.phoneNumber,
		status: 'online',
		createdAt: user.metadata.creationTime,
		updatedAt: user.metadata.lastSignInTime
	})
})
