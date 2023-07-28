import { AxiosError } from "axios";
import { ErrorType, ApiError, ErrorCode } from "rest-interfaces";
import React from "react";
import Heading from "@atlaskit/heading";
import styled from "@emotion/styled";
import { token } from "@atlaskit/tokens";

export type ErrorObjType = {
	type: ErrorType,
	message: string | React.JSX.Element;
}

type SimpleError = {
	message: string;
}

const GENERIC_MESSAGE = "Something went wrong, please try again later.";

export const modifyError = (error: AxiosError<ApiError> | SimpleError): ErrorObjType => {

	const Paragraph = styled.p`
		color: ${token("color.text.subtle")};
	`;
	const errorObj = { type: "error" as ErrorType };
	const warningObj = { type: "warning" as ErrorType };
	const errorCode: ErrorCode = (error instanceof AxiosError ? error?.response?.data?.errorCode : "UNKNOWN") || "UNKNOWN";

	// TODO: map backend errors in frontend
	if (errorCode === "IP_BLOCKED") {
		return {
			...warningObj,
			message: <>
				<Heading level="h500">GitHub for Jira is blocked by your IP allowlist</Heading>
				<Paragraph>
					Your GitHub organization only allows access to some IP addresses. To view<br />
					development work in Jira, you need to add GitHub for Jira’s IP addresses to<br />
					your allowlist.
				</Paragraph>
				<br />
				<a target="_blank" href="https://github.com/atlassian/github-for-jira/blob/main/docs/ip-allowlist.md">Learn how to add GitHub for Jira to your IP allowlist</a>
			</>
		};
	} else if (errorCode === "TIMEOUT") {
		return { ...errorObj, message: "Request timeout" }; //TODO: Better message
	} else if (errorCode === "RATELIMIT") {
		return { ...errorObj, message: "GitHub rate limiting" }; //TODO: Better message
	} else if (errorCode === "SSO_LOGIN") {
		return { ...errorObj, message: "GitHub SSO login required" }; //TODO: Better message
	} else if (errorCode === "RESOURCE_NOT_FOUND") {
		//This should not happen in normal flow, nothing user can do, hence generic message
		return { ...errorObj, message: GENERIC_MESSAGE };
	} else if (errorCode === "INVALID_TOKEN") {
		return { ...errorObj, message: "The GitHub token seems invalid, please re-authorise and try again." }; //TODO: Better message
	} else if (errorCode === "INSUFFICIENT_PERMISSION") {
		return { ...errorObj, message: "You dont' have enough permission for the operation." };
	} else if (errorCode === "INVALID_OR_MISSING_ARG") {
		//This should not happen in normal flow, nothing user can do, hence generic message
		return { ...errorObj, message: GENERIC_MESSAGE };
	} else {
		return { ...errorObj, message: GENERIC_MESSAGE };
	}
};