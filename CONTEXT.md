# 午飯拼單

辦公室同事一起點外賣。誰想叫外賣就開一張拼單，寫上店名和截單時間；其他人加入自己的菜和價錢。到了截單時間，這張單自動關閉。

## Language

**Order (拼單)**:
A lunch order someone opens for the office. It has a restaurant name, a cutoff time, and a status of open or closed.
_Avoid_: claim, group, cart

**Dish (菜)**:
One item a person adds to an order, with a name and a price. Belongs to exactly one owner.
_Avoid_: line item, entry

**Owner**:
The signed-in user a dish belongs to, stored as the auth token subject (`ownerId`). Only that owner may change the dish, and only while the order is open.
_Avoid_: user id, creator

**Opener (開單的人)**:
The signed-in user who opened the order, stored as `openerId`.
_Avoid_: owner (that word is for a dish)

**Cutoff (截單時間)**:
The instant the order stops accepting changes. A scheduled job marks the order closed at that time. After the cutoff, nobody can add, edit, or remove a dish.
_Avoid_: deadline, expiry

## Relationships

- An opener opens many orders.
- An order has many dishes.
- A dish belongs to one order and one owner.
- The dish rule (`packages/domain/src/orders`) rejects a change when the actor is not the dish owner, or when the order is closed or the cutoff has passed.
- The cutoff job (`orders.close`) marks the order closed once the cutoff time is reached.
