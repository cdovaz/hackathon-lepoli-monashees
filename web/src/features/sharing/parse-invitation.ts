export function parseInvitation(input: string, origin: string): string {
  const value = input.trim();
  if (!value || value.length > 4096)
    throw new Error("Insira um token de acesso válido compartilhado pelo paciente.");
  if (/^[A-Za-z0-9._~-]{6,2048}$/.test(value)) return value;
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    throw new Error("Token ou link inválido. Confira o código informado.");
  }
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Use um token desta plataforma. Links externos não são abertos.",
    );
  const match =
    /^\/(?:demo\/)?(?:doctor\/)?consultation\/([A-Za-z0-9._~-]{6,2048})\/?$/.exec(
      url.pathname,
    );
  if (!match)
    throw new Error("Este link ou token não é um código de compartilhamento válido.");
  return match[1];
}
