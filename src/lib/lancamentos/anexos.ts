/** Anexos: só imagem ou PDF, até 4 MB cada (limite de envio da Vercel é 4,5 MB). */
export const TAMANHO_MAXIMO_ANEXO = 4 * 1024 * 1024;
const TIPOS = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"];
export const tipoAnexoPermitido = (tipo: string) => TIPOS.includes(tipo);
export const ACEITAR_ANEXO = TIPOS.join(",");
