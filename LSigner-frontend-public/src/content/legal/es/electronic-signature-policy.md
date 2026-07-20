# Política de Firma Electrónica

**Última actualización:** Sábado 4 de julio de 2026

## 1. Objeto

Este documento describe el funcionamiento técnico y legal del servicio de firma electrónica prestado por LSigner, en cumplimiento del deber de transparencia frente a los Usuarios y frente a terceros que puedan necesitar verificar la validez de un documento firmado a través de la Plataforma. Complementa a los [Términos y Condiciones](/legal/terms-and-conditions) y a la [Política de Privacidad](/legal/privacy-policy).

## 2. Clasificación legal de la firma

De conformidad con el Reglamento (UE) nº 910/2014 (eIDAS), existen tres niveles de firma electrónica: Simple (SES), Avanzada (AES) y Cualificada (QES).

La firma generada por LSigner se clasifica, a la fecha de este documento, como **Firma Electrónica Simple (SES)**, conforme al artículo 3.10 de eIDAS, ya que los datos de creación de firma (clave criptográfica) son gestionados de forma centralizada por LSigner y no están, todavía, vinculados de manera exclusiva e individual a cada firmante mediante una clave propia y exclusiva.

No obstante, se trata de una **SES reforzada**: el proceso incorpora múltiples garantías técnicas —autenticación multifactor, verificación OTP, evidencia forense detallada y firma criptográfica verificable— que exceden ampliamente lo exigido para una firma electrónica simple ordinaria (como un simple clic o checkbox), aportando un nivel de trazabilidad y solidez probatoria comparable, en la práctica, al de sistemas más avanzados, si bien sin la presunción legal reforzada que otorga eIDAS a las firmas AES y QES.

Conforme al artículo 25.1 de eIDAS, no se podrán negar efectos jurídicos ni admisibilidad como prueba en procedimientos judiciales a una firma electrónica por el mero hecho de ser simple. Su valor probatorio final se valorará conforme a las reglas generales de la prueba electrónica, atendiendo precisamente a la robustez de las evidencias descritas en este documento.

LSigner tiene previsto evolucionar hacia un modelo de clave individual por Usuario con capacidad de rotación, lo que permitiría, en el futuro, reclasificar el servicio como Firma Electrónica Avanzada (AES), siempre que se cumplan además el resto de requisitos del artículo 26 de eIDAS. Cualquier cambio en esta clasificación será comunicado a los Usuarios mediante la actualización de este documento.

## 3. Descripción del proceso de firma

1. **Autenticación:** el Usuario inicia sesión mediante credenciales propias y un segundo factor de autenticación (MFA).
2. **Apertura del documento:** al abrir el documento a firmar, el sistema registra un evento de acceso (ver sección 4.1), con independencia de si el Usuario decide finalmente firmar, rechazar o abandonar el proceso.
3. **Verificación OTP:** antes de aplicar la firma, LSigner genera un código de un solo uso (OTP) y lo envía al canal de contacto verificado del Usuario (correo electrónico). El Usuario debe introducir dicho código para continuar. El OTP es generado, gestionado y validado íntegramente por los sistemas de LSigner.
4. **Aplicación de la firma:** una vez verificado el OTP, el backend de LSigner aplica una firma criptográfica sobre una representación canónica de la operación (ver sección 4.3) y genera el documento PDF firmado.
5. **Registro de evidencias:** se almacena de forma inmutable el conjunto de evidencias contextuales y criptográficas descrito en la sección 4.

## 4. Evidencias registradas

### 4.1 Evento de acceso al documento (`ACCESS_OPENED`)

Con independencia de que el documento llegue a firmarse, cada apertura del documento por parte del destinatario genera un registro con:

| Campo               | Descripción                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `ip`                | Dirección IP del firmante en el momento del acceso               |
| `user_agent`        | Navegador y sistema operativo utilizados                         |
| `is_first_access`   | Indica si es el primer acceso al documento o un acceso posterior |
| `first_accessed_at` | Marca temporal del primer acceso                                 |
| `last_accessed_at`  | Marca temporal del acceso más reciente                           |

### 4.2 Evidencia contextual de la firma

En el momento de firmar, rechazar o revocar, se genera un artefacto (`DocumentSignedArtifact`) que incluye la siguiente evidencia contextual:

| Campo                    | Descripción                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `verification_method`    | Método de verificación empleado (`"OTP"`)                                                         |
| `verification_reference` | Referencia enmascarada del canal donde se envió el OTP (email u otro canal parcialmente ocultado) |
| `recipient_email`        | Correo electrónico del firmante                                                                   |
| `recipient_name`         | Nombre del firmante                                                                               |
| `ip`                     | Dirección IP desde la que se realizó la acción                                                    |
| `user_agent`             | Navegador y sistema operativo utilizados                                                          |
| `signed_at`              | Marca temporal exacta (formato ISO 8601) de la acción                                             |
| `mime_type`              | Tipo de archivo del documento                                                                     |
| `original_filename`      | Nombre original del fichero                                                                       |
| `reason`                 | (Solo en rechazo/revocación) motivo proporcionado voluntariamente por el Usuario                  |
| `state`                  | Estado de la operación: `SIGNED`, `REJECTED` o `REVOKED`                                          |

### 4.3 Evidencia criptográfica

Para garantizar la integridad y el no repudio de cada firma, LSigner genera y almacena:

| Campo                  | Descripción                                                                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signature`            | Firma digital Ed25519 (codificada en base64) sobre el payload canónico de la operación                                                                                             |
| `signature_algorithm`  | Algoritmo empleado (`"Ed25519"`)                                                                                                                                                   |
| `key_fingerprint`      | Huella SHA-256 de la clave pública Ed25519 empleada, que identifica de forma única la clave sin revelarla                                                                          |
| `key_version`          | Versión de la clave utilizada, para permitir la rotación de claves manteniendo la trazabilidad histórica                                                                           |
| `public_key_hex`       | Clave pública en formato hexadecimal, incluida junto a la evidencia para que la firma pueda verificarse de forma autónoma en el futuro, sin depender de que LSigner siga operativo |
| `canonical_payload`    | Representación JSON determinista de los datos firmados (ver sección 4.4)                                                                                                           |
| `file_hash`            | Huella SHA-256 del binario del documento firmado, que permite detectar cualquier alteración posterior                                                                              |
| `previous_artifact_id` | Identificador del artefacto de evidencia anterior relativo al mismo documento, si existiera, formando una cadena de custodia verificable en caso de re-firmas o firmas sucesivas   |

**Ed25519** es un algoritmo de firma digital de curva elíptica ampliamente utilizado por su seguridad y eficiencia, que garantiza que solo quien posea la clave privada correspondiente pudo generar una firma válida verificable con la clave pública asociada.

### 4.4 Payload canónico firmado

La firma criptográfica no se aplica directamente sobre el PDF, sino sobre una representación JSON determinista ("canónica") de los datos relevantes de la operación, lo que garantiza que cualquier verificador obtenga siempre el mismo resultado al recomputar la firma. Su estructura es:

```json
{
  "actor_id": "<UUID del firmante>",
  "actor_type": "RECIPIENT",
  "document_id": "<UUID del documento>",
  "file_hash": "<SHA-256 del documento>",
  "key_version": 1,
  "previous_artifact_id": null,
  "recipient_id": "<UUID del firmante>",
  "state": "SIGNED",
  "timestamp": "2026-07-04T10:00:00Z"
}
```

### 4.5 Trazabilidad y cadena de custodia

Cada artefacto de evidencia puede referenciar al artefacto inmediatamente anterior relativo al mismo documento (`previous_artifact_id`), formando una cadena verificable que permite reconstruir el histórico completo de accesos, firmas, rechazos o revocaciones de un documento, incluyendo la detección de cualquier alteración en el `file_hash` entre eventos.

## 5. Rechazo y revocación

Un Usuario puede rechazar o revocar una solicitud de firma. En ambos casos, se genera un artefacto de evidencia con los mismos campos contextuales descritos en la sección 4.2, incluyendo el estado correspondiente (`REJECTED` o `REVOKED`) y, si el Usuario lo proporciona voluntariamente, un motivo (`reason`).

## 6. Verificación independiente de una firma

Dado que la clave pública (`public_key_hex`) se almacena junto con cada evidencia, cualquier tercero (por ejemplo, un perito judicial o una de las partes en un litigio) puede verificar de forma independiente, sin depender de los sistemas de LSigner, que:

- La firma (`signature`) corresponde efectivamente al `canonical_payload` almacenado.
- El documento no ha sido alterado desde su firma, comparando el `file_hash` almacenado con el hash recalculado del PDF.

Esto refuerza el valor probatorio del sistema, ya que la verificación no depende exclusivamente de la palabra de LSigner, sino de una comprobación criptográfica objetiva y reproducible.

## 7. Conservación de las evidencias

Las evidencias descritas en este documento se conservan conforme a los plazos establecidos en la [Política de Conservación y Custodia Documental](/legal/data-retention-policy), actualmente fijados en 6 años desde la fecha de la firma.

## 8. Limitaciones actuales del sistema

En aras de la transparencia, LSigner informa de las siguientes limitaciones del sistema a la fecha de este documento:

- La clave criptográfica empleada para firmar (`key_fingerprint`/`key_version`) es actualmente **compartida a nivel de sistema**, no individual por Usuario. Esto es lo que determina la clasificación como SES y no como AES (ver sección 2).
- El servicio no captura datos biométricos de firma manuscrita (trazo, presión, velocidad), ya que la verificación de identidad se realiza mediante OTP y no mediante firma manuscrita digitalizada.
- El sistema no constituye, a la fecha de este documento, un servicio de firma electrónica cualificada (QES), por lo que no aplica la presunción reforzada de fiabilidad asociada a este nivel superior.

## 9. Cambios en esta Política

LSigner podrá actualizar esta Política de Firma Electrónica para reflejar cambios técnicos relevantes (por ejemplo, la implementación de claves individuales por Usuario) o cambios normativos. Cualquier cambio relevante se reflejará actualizando la fecha de "última actualización" al inicio de este documento.
