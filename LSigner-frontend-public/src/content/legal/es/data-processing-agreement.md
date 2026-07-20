# Contrato de Encargado de Tratamiento (DPA)

**Última actualización:** Sábado 4 de julio de 2026

## 0. Nota sobre el ámbito de aplicación

Este Contrato de Encargado de Tratamiento ("DPA") se aplica a las **cuentas empresariales (B2B)** de la Plataforma LSigner, mediante las cuales una empresa gestiona el envío de documentos a firmar a sus propios empleados o colaboradores a través de un panel de administración específico. Este DPA se incorpora automáticamente, como anexo vinculante, al contrato de servicio suscrito entre LSigner y la empresa cliente en el momento en que esta active un plan empresarial.

## 1. Partes

- **El Responsable del tratamiento:** la empresa cliente que contrata el plan empresarial de LSigner (en adelante, "el Cliente"), identificada mediante los datos facilitados en el proceso de contratación.
- **El Encargado del tratamiento:** LSigner, S.L., con NIF B12345678 y domicilio en Carrer de Maria Aurèlia Capmany i Farnés, 67, 17006, Girona, España (en adelante, "LSigner").

## 2. Objeto

El presente DPA regula el tratamiento de datos personales que LSigner realiza por cuenta del Cliente, en su condición de encargado del tratamiento, en el marco de la prestación del servicio de firma electrónica a los empleados o colaboradores del Cliente, en cumplimiento del artículo 28 del RGPD.

## 3. Descripción del tratamiento

- **Naturaleza del tratamiento:** alojamiento, gestión, envío, firma y custodia de documentos electrónicos, junto con la generación de evidencias técnicas de dicha firma.
- **Finalidad:** permitir que el Cliente envíe documentos a sus empleados o colaboradores a través de la Plataforma, y que estos los firmen electrónicamente, quedando constancia de la operación.
- **Categorías de interesados:** empleados, colaboradores o cualquier otra persona física designada por el Cliente como destinataria de documentos a firmar dentro de su cuenta empresarial.
- **Categorías de datos tratados:** nombre, correo electrónico, y, en su caso, teléfono de los empleados/colaboradores; contenido de los documentos enviados por el Cliente para su firma; evidencias de firma asociadas (dirección IP, user-agent, marcas temporales, resultado de verificación OTP, evidencia criptográfica), conforme se describe en la [Política de Firma Electrónica](/legal/electronic-signature-policy).
- **Duración del tratamiento:** mientras el Cliente mantenga activo su plan empresarial, y durante el plazo de conservación posterior aplicable a los documentos y evidencias de firma, conforme a la [Política de Conservación y Custodia Documental](/legal/document-retention-policy).

## 4. Alcance de las cuentas empresariales

Las cuentas empresariales operan bajo un sistema de roles diferenciado:

- Los usuarios con rol de **administrador** (designados por el Cliente) pueden enviar documentos a firmar a los empleados/colaboradores de su propia organización y consultar el estado de dichos documentos y firmas desde un panel de administración.
- Los usuarios con rol de **empleado/colaborador** pueden firmar los documentos que les envíe su organización, pero no pueden utilizar la Plataforma para enviar o firmar documentos con terceros externos a dicha organización.

Esta segmentación implica que los datos gestionados dentro de una cuenta empresarial se limitan al ámbito interno de la organización del Cliente, sin mezclarse con el uso que otros Usuarios (particulares u otras empresas clientas) puedan hacer de la Plataforma de forma independiente.

## 5. Obligaciones de LSigner como Encargado del tratamiento

LSigner se compromete a:

a) Tratar los datos personales únicamente siguiendo las instrucciones documentadas del Cliente, incluidas las relativas a transferencias internacionales, salvo que esté obligado a ello por el Derecho de la Unión o de un Estado miembro, en cuyo caso informará al Cliente de esa exigencia legal previa, salvo prohibición legal.

b) Garantizar que las personas autorizadas para tratar los datos se han comprometido a respetar la confidencialidad o están sujetas a una obligación de confidencialidad de naturaleza legal o contractual.

c) Adoptar las medidas de seguridad técnicas y organizativas descritas en la [Política de Privacidad](/legal/privacy-policy) y en la Política de Firma Electrónica, conforme al artículo 32 del RGPD.

d) Respetar las condiciones establecidas en este DPA para recurrir a otro encargado del tratamiento (subencargado), conforme a la sección 6.

e) Asistir al Cliente, dentro de lo razonablemente posible y teniendo en cuenta la naturaleza del tratamiento, mediante medidas técnicas y organizativas apropiadas, para el cumplimiento de su obligación de responder a las solicitudes de ejercicio de derechos de los interesados.

f) Ayudar al Cliente a garantizar el cumplimiento de las obligaciones establecidas en los artículos 32 a 36 del RGPD (seguridad del tratamiento, notificación de violaciones de seguridad, evaluaciones de impacto), teniendo en cuenta la naturaleza del tratamiento y la información a disposición de LSigner.

g) A elección del Cliente, suprimir o devolver todos los datos personales una vez finalice la prestación del servicio de tratamiento, y suprimir las copias existentes, salvo que el Derecho de la Unión o de un Estado miembro exijan su conservación (por ejemplo, el plazo de conservación de evidencias de firma con valor probatorio, indicado en la Política de Conservación).

h) Poner a disposición del Cliente toda la información necesaria para demostrar el cumplimiento de las obligaciones establecidas en el artículo 28 del RGPD, y permitir y contribuir a la realización de auditorías, incluidas inspecciones, por parte del Cliente o de otro auditor autorizado por este, conforme a la sección 8.

i) Informar inmediatamente al Cliente si, en su opinión, alguna instrucción infringe el RGPD u otras disposiciones de protección de datos.

## 6. Subencargados del tratamiento

El Cliente autoriza de forma general a LSigner a recurrir a los siguientes subencargados para la prestación del servicio, informándose de cualquier cambio con antelación razonable, de modo que el Cliente pueda oponerse por motivos justificados:

| Subencargado                                      | Función                                                                                                       | Ubicación                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Hostinger                                         | Alojamiento de infraestructura (base de datos PostgreSQL y backups en S3)                                     | Francia (UE)                                                                 |
| Dokploy                                           | Orquestación y despliegue de contenedores sobre la infraestructura anterior                                   | Francia (UE)                                                                 |
| Proveedor de entrega de correo electrónico (SMTP) | Enrutamiento y entrega de correos electrónicos, incluidos los que contienen códigos OTP generados por LSigner | Reino Unido (país con Decisión de Adecuación vigente de la Comisión Europea) |

LSigner garantizará que estos subencargados asumen las mismas obligaciones en materia de protección de datos que las establecidas en este DPA, mediante los contratos correspondientes, y seguirá siendo plenamente responsable ante el Cliente del cumplimiento de dichas obligaciones por parte de sus subencargados.

## 7. Transferencias internacionales

La única transferencia internacional de datos personales fuera del Espacio Económico Europeo en el marco de este tratamiento es la relativa al enrutamiento de correos electrónicos a través del proveedor SMTP con sede en el Reino Unido, país amparado por la Decisión de Adecuación de la Comisión Europea (renovada el 19 de diciembre de 2025, válida hasta diciembre de 2031), por lo que dicha transferencia no requiere garantías adicionales.

## 8. Auditorías e inspecciones

El Cliente podrá solicitar a LSigner, con una antelación razonable y con una periodicidad razonable, información y documentación que permita verificar el cumplimiento de las obligaciones establecidas en este DPA. LSigner podrá proporcionar dicha información mediante informes de auditoría propios o de terceros, cuando estén disponibles, como alternativa a una auditoría presencial, salvo que el Cliente justifique razonablemente la necesidad de esta última.

## 9. Notificación de violaciones de seguridad

LSigner notificará al Cliente, sin dilación indebida y a más tardar en el plazo de 48 horas desde que tenga constancia de ello, cualquier violación de la seguridad de los datos personales tratados en el marco de este DPA que pueda afectar a los empleados/colaboradores del Cliente, proporcionando la información razonablemente disponible para que el Cliente pueda, a su vez, cumplir con sus obligaciones de notificación conforme a los artículos 33 y 34 del RGPD.

## 10. Destino de los datos a la finalización del contrato

Al finalizar la relación contractual con el Cliente (baja del plan empresarial), LSigner, a elección del Cliente, suprimirá o devolverá los datos personales de los empleados/colaboradores, así como los documentos y evidencias asociadas, salvo que deban conservarse por el plazo indicado en la Política de Conservación y Custodia Documental por razón de su valor probatorio y de las obligaciones legales de conservación documental aplicables.

## 11. Responsabilidad

Cada parte será responsable del cumplimiento de sus propias obligaciones conforme al RGPD y a este DPA. El Cliente, como Responsable del tratamiento, es responsable de la licitud de las instrucciones dadas a LSigner y de contar con una base legal adecuada para el tratamiento de los datos de sus empleados/colaboradores (por ejemplo, la ejecución de la relación laboral o el interés legítimo aplicable).

## 12. Duración

Este DPA estará vigente mientras el Cliente mantenga activo un plan empresarial en la Plataforma, y se extinguirá automáticamente cuando finalice dicha relación contractual, sin perjuicio de las obligaciones de conservación o supresión de datos que sobrevivan a su finalización conforme a la sección 10.

## 13. Legislación aplicable

Este DPA se rige por la legislación española y por el RGPD, y se somete a los mismos Juzgados y Tribunales indicados en los Términos y Condiciones del servicio.
