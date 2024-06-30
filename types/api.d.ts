export type LogServerErrorCode = 'auth_error';

export type LogServerError = {
	status: number;
	code: LogServerErrorCode;
	message: string;
};

export type LogServerSuccess<T> = T & {
	status: 200;
};

export type LogServerResponse<T> = LogServerError | LogServerSuccess<T>;

// PUT /dump

export type LogServerPUTDumpResponse = {
	correlation: string;
};
