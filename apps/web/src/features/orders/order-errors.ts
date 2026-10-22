import type { MessageDescriptor } from '@lingui/core';

import { msg } from '@lingui/core/macro';
import { APP_ERROR_CODES, type AppErrorCode } from '@lunch-split/shared/error-codes';

/** Translated text per backend error code. Resolve with `t(descriptor)` at the call site. */
export const ORDER_ERROR_MESSAGES: Partial<Record<AppErrorCode, MessageDescriptor>> = {
	[APP_ERROR_CODES.unauthenticated]: msg`請先登入。`,
	[APP_ERROR_CODES.notFound]: msg`找不到這張單或這道菜。`,
	[APP_ERROR_CODES.orderInvalid]: msg`請填寫店名，截單時間要晚於現在。`,
	[APP_ERROR_CODES.dishInvalid]: msg`請填寫菜名和大於零的價錢。`,
	[APP_ERROR_CODES.orderClosed]: msg`已經截單，不能再改。`,
	[APP_ERROR_CODES.notDishOwner]: msg`只能改自己點的菜。`,
};
