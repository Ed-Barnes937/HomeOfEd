// Encoders for mountApp({ user }) that carry the sprout ROLE through the
// test-kit's id-only header. IwftApp.tsx decodes them back into a SproutUser.
// (The header transports only `user.id`, so the role rides inside the id.)

/** Authenticate `.iwft` requests as a parent with the given id. */
export const asParent = (id: string): { id: string } => ({ id: `parent:${id}` })

/** Authenticate `.iwft` requests as a child with the given id + owning parent. */
export const asChild = (id: string, parentId: string): { id: string } => ({
  id: `child:${id}:${parentId}`,
})
