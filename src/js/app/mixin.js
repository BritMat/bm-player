/**
 * A feature's methods onto the player (v3.47.0).
 *
 * Each file in app/ is a class of BMPlayer's methods. Copying them onto
 * BMPlayer.prototype makes them the player's own, as they were when they
 * were all written in app.js: `this` is the player, and every call between
 * them works the same. Nothing is added at run time: the methods sit on the
 * prototype exactly as class methods do.
 *
 * Two files defining the same method is an error at start, not a quiet
 * replacement of one by the other.
 */
export function mixin (target, ...parts) {
  for (const part of parts) {
    for (const [name, desc] of Object.entries(Object.getOwnPropertyDescriptors(part.prototype))) {
      if (name === 'constructor') continue;
      if (Object.prototype.hasOwnProperty.call(target.prototype, name)) throw new Error(`${target.name}.${name} is defined twice (again in ${part.name})`);
      Object.defineProperty(target.prototype, name, desc);
    }
  }
  return target;
}
