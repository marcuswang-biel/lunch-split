import { type AppErrorData } from '@lunch-split/shared/error-codes';
import { type ConvexError } from 'convex/values';
import { Cause, Effect, Exit } from 'effect';

/** Run a domain Effect program and map its expected failure at the Convex boundary. */
export async function runEffect<A, E>(
	program: Effect.Effect<A, E>,
	toConvexError: (error: E) => ConvexError<AppErrorData>,
): Promise<A> {
	const exit = await Effect.runPromiseExit(program);
	if (Exit.isFailure(exit)) {
		const failure = Cause.findErrorOption(exit.cause);
		if (failure._tag === 'Some') throw toConvexError(failure.value);
		throw Cause.squash(exit.cause);
	}
	return exit.value;
}
