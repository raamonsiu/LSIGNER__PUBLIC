# Política de Conservación y Custodia Documental

**Última actualización:** Sábado 4 de julio de 2026

## 1. Objeto

Este documento detalla durante cuánto tiempo LSigner conserva cada categoría de datos e información relacionada con el uso de la Plataforma, con qué garantías de integridad, y qué ocurre una vez transcurridos dichos plazos. Complementa a la [Política de Privacidad](/legal/privacy-policy) y a la [Política de Firma Electrónica](/legal/electronic-signature-policy).

## 2. Documentos firmados y evidencias de firma

Los documentos firmados, junto con la totalidad de las evidencias descritas en la Política de Firma Electrónica (evidencia contextual, evidencia criptográfica y payload canónico), se conservan durante **6 años** desde la fecha de la firma, rechazo o revocación correspondiente.

Este plazo se fija tomando como referencia el artículo 30 del Código de Comercio, relativo a la obligación de conservación de documentación mercantil, con el fin de preservar el valor probatorio de la firma durante un periodo razonable en el que pudiera plantearse una reclamación relacionada con el documento firmado.

Durante este periodo, LSigner garantiza la integridad de los documentos y evidencias mediante los mecanismos criptográficos descritos en la Política de Firma Electrónica (hash del documento, firma Ed25519 verificable, cadena de custodia mediante `previous_artifact_id`), de modo que cualquier alteración posterior sea detectable.

## 3. Eventos de acceso al documento

Los eventos de apertura de documentos (`ACCESS_OPENED`) forman parte de la cadena de evidencias de una operación de firma y se conservan durante el mismo plazo que el documento y las evidencias de firma a las que están asociados (6 años), dado que aportan contexto relevante sobre cuándo y desde dónde se accedió al documento antes de su firma, rechazo o revocación.

## 4. Datos de la cuenta de usuario

Los datos asociados a la cuenta de un Usuario (nombre, correo electrónico, configuración, historial de actividad no vinculado directamente a una firma concreta) se conservan mientras la cuenta permanezca activa, y durante **12 meses adicionales** tras la baja o cancelación de la cuenta, con el fin de permitir su posible reactivación y de resolver disputas pendientes relacionadas con el servicio.

Transcurrido dicho plazo de 12 meses sin reactivación, los datos de la cuenta se eliminan o anonimizan, sin perjuicio de que los documentos y evidencias de firma generados durante la vida de la cuenta sigan conservándose por el plazo indicado en la sección 2, dado su valor probatorio independiente.

## 5. Código de verificación OTP

El código OTP generado para cada operación de verificación tiene una naturaleza estrictamente efímera: se elimina automáticamente tras su validación exitosa o tras su expiración (en el orden de minutos desde su generación). LSigner no conserva el código OTP en sí como parte del histórico ni de las evidencias; lo que se conserva es el **resultado** de dicha verificación (método utilizado y referencia enmascarada del canal), conforme a lo descrito en la Política de Firma Electrónica.

## 6. Logs técnicos y de seguridad generales

Los registros técnicos y de seguridad no vinculados directamente a una operación de firma concreta (por ejemplo, registros de acceso a la infraestructura, intentos fallidos de autenticación) se conservan durante **12 meses**, plazo razonable para la detección y análisis de incidentes de seguridad, transcurrido el cual se eliminan de forma automática.

## 7. Analítica propia agregada

El sistema de analítica interno y autoalojado de LSigner procesa la dirección IP de cada solicitud de forma **efímera**, únicamente para el cálculo de estadísticas agregadas de uso de la Plataforma. Una vez computado el dato agregado correspondiente, la dirección IP individual no se conserva ni se almacena de forma histórica o individualizada.

## 8. Copias de seguridad (backups)

Los backups de la base de datos (almacenados en un contenedor S3 sobre la misma infraestructura de Hostinger en Francia) se mantienen bajo un ciclo de rotación continuo, con el fin exclusivo de garantizar la recuperación del servicio ante incidentes técnicos. Las copias de seguridad están sujetas a las mismas medidas de seguridad que los datos en producción, y los datos eliminados de los sistemas de producción conforme a los plazos anteriores se eliminan también de las copias de seguridad a medida que estas se rotan, sin que se generen copias de seguridad indefinidas o de conservación permanente.

## 9. Solicitudes de supresión (derecho al olvido) y su límite

Cuando un Usuario solicita la eliminación de sus datos personales conforme a su derecho de supresión, LSigner atenderá dicha solicitud respecto de los datos de cuenta y cualquier dato no sujeto a una obligación legal de conservación. No obstante, conforme al artículo 17.3.b) del RGPD, **no será posible eliminar los documentos firmados ni las evidencias de firma antes de que transcurra el plazo de conservación indicado en la sección 2**, dado que dicha conservación responde a una obligación legal y a la necesidad de preservar el valor probatorio de la firma frente a terceros, incluido el propio Usuario que la solicitó.

## 10. Conservación extraordinaria por litigio o requerimiento

En caso de que un documento, evidencia o dato esté relacionado con un litigio, procedimiento judicial o requerimiento de una autoridad competente en curso, LSigner podrá conservar dicha información más allá de los plazos generales indicados en este documento, durante el tiempo estrictamente necesario para dar cumplimiento a dicho procedimiento o requerimiento.

## 11. Eliminación o anonimización al finalizar los plazos

Transcurridos los plazos de conservación indicados en este documento, los datos correspondientes se eliminan de forma definitiva o se anonimizan de manera irreversible, de modo que no sea posible volver a asociarlos a una persona identificada o identificable.

## 12. Revisión de esta Política

LSigner podrá revisar los plazos de conservación indicados en este documento para adaptarlos a cambios normativos, jurisprudenciales o de la propia infraestructura técnica del servicio. Cualquier cambio relevante se reflejará actualizando la fecha de "última actualización" al inicio de este documento.
