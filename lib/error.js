
/**
 * Used during transcation verification when a source txout is missing.
 *
 * When a transaction is being verified by the memory pool this error causes
 * it to be added to the orphan pool instead of being discarded.
 */
function MissingSourceError(msg, missingTxHash) {
	// TODO: Since this happens in normal operation, perhaps we should
	//       avoid generating a whole stack trace.
	Error.call(this);
	Error.captureStackTrace(this, arguments.callee);
	this.message = msg;
	this.missingTxHash = missingTxHash;
	this.name = 'MissingSourceError';
};

MissingSourceError.prototype.__proto__ = Error.prototype;

exports.MissingSourceError = MissingSourceError;
