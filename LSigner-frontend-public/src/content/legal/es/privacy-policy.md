# Política de Privacidad

**Última actualización:** Sábado 4 de julio de 2026

## 1. Responsable del tratamiento

- **Responsable:** LSigner, S.L.
- **NIF:** B12345678
- **Domicilio:** Carrer de Maria Aurèlia Capmany i Farnés, 67, 17006, Girona, España
- **Correo electrónico de contacto (Delegado de Protección de Datos / privacidad):** info@lsigner.com

## 2. Datos que tratamos

LSigner trata las siguientes categorías de datos personales, en función de cómo el Usuario interactúa con la Plataforma:

### 2.1 Datos de registro y cuenta

Nombre, apellidos, correo electrónico, número de teléfono (si se usa MFA por SMS), contraseña (almacenada mediante hash seguro), y, en el caso de cuentas empresariales (B2B), datos del empleado facilitados por la empresa contratante (nombre, email corporativo, rol).

### 2.2 Datos de autenticación y verificación

Registros de acceso (login), estado de verificación multifactor (MFA), y evidencia de verificación OTP (canal utilizado —correo electrónico—, marca temporal de envío y de validación). El código OTP es generado y validado íntegramente por los sistemas propios de LSigner; el proveedor de correo electrónico mencionado en la sección 4 se limita a transportar el mensaje que contiene dicho código hasta la bandeja de entrada del Usuario, sin intervenir en su generación, almacenamiento o validación. El código OTP en sí **no se conserva** una vez utilizado o expirado.

### 2.3 Datos del proceso de firma (evidencias)

En el momento en que un Usuario firma un documento, LSigner recoge y conserva las siguientes evidencias con el fin de garantizar la integridad, autenticidad y no repudio de la firma:

- Dirección IP del dispositivo utilizado.
- Fecha y hora exacta de la firma (timestamp).
- Información del dispositivo y navegador (user-agent).
- Identificador único de la operación de firma.
- Hash criptográfico del documento antes y después de la firma.
- Resultado del proceso de verificación OTP asociado a esa firma concreta.
- Geolocalización aproximada derivada de la dirección IP (a nivel de ciudad/región, no de precisión GPS).

LSigner **no recoge datos biométricos** de la firma manuscrita (trazo, presión, velocidad), ya que el proceso de firma se realiza mediante verificación OTP y no mediante captura de firma manuscrita digitalizada.

### 2.4 Documentos firmados

El contenido de los documentos que el Usuario sube y firma a través de la Plataforma. LSigner no controla ni modera el contenido de estos documentos, que puede incluir datos personales de terceros introducidos por el propio Usuario (por ejemplo, si el documento es un contrato con datos de otra persona). En estos casos, el Usuario actúa como responsable de dicho tratamiento y LSigner como encargado, en los términos descritos en el Contrato de Encargado de Tratamiento.

### 2.5 Datos técnicos y de navegación

Cookies y tecnologías similares, según lo descrito en la [Política de Cookies](/legal/cookie-policy).

## 3. Finalidades del tratamiento

| Finalidad                                                                                | Base legal (RGPD)                                                     |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Gestión del registro y la cuenta de Usuario                                              | Ejecución de un contrato (art. 6.1.b)                                 |
| Autenticación, MFA y verificación OTP                                                    | Ejecución de un contrato (art. 6.1.b)                                 |
| Generación y conservación de evidencias de firma                                         | Ejecución de un contrato (art. 6.1.b) y obligación legal (art. 6.1.c) |
| Conservación de documentos firmados                                                      | Ejecución de un contrato (art. 6.1.b)                                 |
| Comunicaciones de servicio (notificaciones sobre firmas, seguridad de la cuenta)         | Ejecución de un contrato (art. 6.1.b)                                 |
| Comunicaciones comerciales (si el Usuario lo consiente)                                  | Consentimiento (art. 6.1.a)                                           |
| Prevención del fraude y seguridad de la Plataforma                                       | Interés legítimo (art. 6.1.f)                                         |
| Cumplimiento de obligaciones legales (conservación mercantil, requerimientos judiciales) | Obligación legal (art. 6.1.c)                                         |

## 4. Destinatarios y encargados del tratamiento

LSigner puede compartir datos personales con los siguientes terceros, en su condición de encargados del tratamiento, en la medida necesaria para prestar el servicio:

- **Proveedor de alojamiento (hosting):** Hostinger, con infraestructura desplegada específicamente en su ubicación en Francia (Unión Europea). Los datos de la base de datos PostgreSQL y los backups (almacenados en un contenedor S3) residen en territorio de la UE.
- **Proveedor de despliegue/orquestación de contenedores:** Dokploy, sobre la misma infraestructura anterior.
- **Proveedor de entrega de correo electrónico (SMTP):** proveedor con sede en el Reino Unido, encargado de enrutar y entregar los correos electrónicos enviados desde el dominio de LSigner, incluidos los que contienen el código OTP generado por los sistemas propios de LSigner. Este proveedor actúa como un mero transportista del mensaje y no participa en la generación, almacenamiento ni validación del código OTP. Las transferencias de datos a este proveedor están amparadas por la Decisión de Adecuación de la Comisión Europea relativa al Reino Unido (renovada el 19 de diciembre de 2025, válida hasta diciembre de 2031), por lo que no se requieren garantías adicionales como Cláusulas Contractuales Tipo.
- **Empresas clientes (en el caso de uso B2B):** cuando un Usuario firma documentos en el contexto de una relación con una empresa cliente de LSigner (por ejemplo, su empleador), dicha empresa puede tener acceso a los documentos y evidencias de firma relacionados con esa relación, en su condición de responsable del tratamiento respecto a sus propios empleados o clientes.
- **Autoridades públicas:** cuando exista una obligación legal o un requerimiento judicial.

LSigner no vende ni cede datos personales a terceros con fines publicitarios.

## 5. Transferencias internacionales de datos

Como norma general, los datos se almacenan y procesan dentro de la Unión Europea (infraestructura en Francia). La única transferencia fuera de la UE es la relativa al enrutamiento y entrega de correos electrónicos (incluidos los que contienen el código OTP) a través del proveedor de correo con sede en el Reino Unido, país que cuenta con Decisión de Adecuación vigente por parte de la Comisión Europea, lo que garantiza un nivel de protección equivalente al de la UE sin necesidad de mecanismos adicionales de transferencia. El código OTP en sí es generado, almacenado y validado exclusivamente en la infraestructura de LSigner en la UE; el proveedor británico únicamente transporta el correo que lo contiene.

## 6. Plazos de conservación

- **Documentos firmados y evidencias de firma:** se conservan durante **6 años** desde la fecha de la firma, en línea con el plazo de conservación de documentación mercantil establecido en el artículo 30 del Código de Comercio, con el fin de preservar su valor probatorio ante posibles reclamaciones.
- **Datos de la cuenta:** mientras el Usuario mantenga su cuenta activa, y hasta 12 meses adicionales tras la baja, por si el Usuario desea reactivarla o para resolver disputas pendientes.
- **Código OTP:** de naturaleza efímera; se elimina automáticamente tras su uso o expiración (en cuestión de minutos).
- **Logs técnicos y de seguridad no vinculados a una firma concreta:** hasta 12 meses.

Transcurridos estos plazos, los datos se eliminan o se anonimizan de forma irreversible, salvo que exista una obligación legal que exija su conservación adicional.

## 7. Derechos de los Usuarios

De conformidad con el RGPD y la LOPDGDD, el Usuario puede ejercer en cualquier momento los siguientes derechos, enviando una solicitud a privacidad@lsigner.com, adjuntando copia de un documento identificativo:

- **Acceso:** conocer qué datos tratamos sobre el Usuario.
- **Rectificación:** corregir datos inexactos.
- **Supresión:** solicitar la eliminación de sus datos, salvo que exista obligación legal de conservarlos (por ejemplo, evidencias de firma dentro del plazo de conservación mercantil).
- **Oposición:** oponerse al tratamiento basado en interés legítimo.
- **Limitación del tratamiento:** solicitar la limitación en determinados supuestos.
- **Portabilidad:** recibir sus datos en un formato estructurado y de uso común.
- **Retirar el consentimiento** en cualquier momento, cuando el tratamiento se base en este.

El Usuario tiene también derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD) si considera que sus derechos no han sido debidamente atendidos.

## 8. Seguridad de los datos

LSigner aplica medidas técnicas y organizativas apropiadas para proteger los datos personales, incluyendo cifrado de contraseñas mediante funciones de hash seguras, autenticación multifactor, cifrado de comunicaciones (HTTPS/TLS), copias de seguridad periódicas y control de accesos a la infraestructura.

## 9. Menores de edad

La Plataforma no está dirigida a menores de 18 años. LSigner no recaba conscientemente datos de menores. Si se detectara que un menor ha proporcionado datos sin el consentimiento de su tutor legal, estos serán eliminados.

## 10. Cambios en esta Política

LSigner podrá modificar esta Política de Privacidad para adaptarla a cambios normativos o funcionales de la Plataforma. Cualquier cambio relevante será comunicado a los Usuarios registrados y se reflejará actualizando la fecha de "última actualización" al inicio de este documento.
