export function containedImageBounds(
  container: { width: number; height: number },
  image: { width: number; height: number },
) {
  if (
    container.width <= 0 ||
    container.height <= 0 ||
    image.width <= 0 ||
    image.height <= 0
  ) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const scale = Math.min(
    container.width / image.width,
    container.height / image.height,
  );
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    left: (container.width - width) / 2,
    top: (container.height - height) / 2,
    width,
    height,
  };
}
