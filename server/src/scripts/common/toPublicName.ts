export default function toPublicName(fieldName: string): string {
  return `${fieldName[0].replace('_', '')}${fieldName.slice(1)}`;
}
