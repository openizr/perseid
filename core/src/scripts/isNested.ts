export default function isNested<T>(variable: T): boolean {
  if (Array.isArray(variable)) {
    return true;
  }
  if (Object.prototype.toString.call(variable) !== '[object Object]') {
    return false;
  }
  const { constructor } = variable as unknown as { constructor: ObjectConstructor };
  if (constructor === undefined) {
    return true;
  }
  const { prototype } = constructor;
  if (Object.prototype.toString.call(prototype) !== '[object Object]') {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(prototype, 'isPrototypeOf') === false) {
    return false;
  }
  return true;
}
