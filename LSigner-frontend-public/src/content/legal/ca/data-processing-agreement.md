# Contracte d'Encarregat de Tractament (DPA)

_Última actualització:_ Dissabte 4 de juliol de 2026

## 0. Nota sobre l'àmbit d'aplicació

Aquest Contracte d'Encarregat de Tractament ("DPA") s'aplica als _comptes empresarials (B2B)_ de la Plataforma LSigner, mitjançant les quals una empresa gestiona l'enviament de documents a signar als seus propis empleats o col·laboradors a través d'un panell d'administració específic. Aquest DPA s'incorpora automàticament, com a annex vinculant, al contracte de servei subscrit entre LSigner i l'empresa client en el moment en què aquesta activi un pla empresarial.

## 1. Parts

- _El Responsable del tractament:_ l'empresa client que contracta el pla empresarial de LSigner (d'ara endavant, "el Client"), identificada mitjançant les dades facilitades en el procés de contractació.
- _L'Encarregat del tractament:_ LSigner, S.L., amb NIF B12345678 i domicili en Carrer de Maria Aurèlia Capmany i Farnés, 67, 17006, Girona, Espanya (d'ara endavant, "LSigner").

## 2. Objecte

El present DPA regula el tractament de dades personals que LSigner realitza per compte del Client, en la seva condició d'encarregat del tractament, en el marc de la prestació del servei de signatura electrònica als empleats o col·laboradors del Client, en compliment de l'article 28 del RGPD.

## 3. Descripció del tractament

- _Naturalesa del tractament:_ allotjament, gestió, enviament, signatura i custòdia de documents electrònics, juntament amb la generació d'evidències tècniques d'aquesta signatura.
- _Finalitat:_ permetre que el Client enviï documents als seus empleats o col·laboradors a través de la Plataforma, i que aquests els signin electrònicament, quedant constància de l'operació.
- _Categories d'interessats:_ empleats, col·laboradors o qualsevol altra persona física designada pel Client com a destinatària de documents a signar dins del seu compte empresarial.
- _Categories de dades tractades:_ nom, correu electrònic, i, si és el cas, telèfon dels empleats/col·laboradors; contingut dels documents enviats pel Client per a la seva signatura; evidències de signatura associades (adreça IP, user-*agent, marques temporals, resultat de verificació OTP, evidència criptogràfica), conforme es descriu en la [Política de Signatura Electrònica](/legal/electronic-*signature-\*policy).
- _Durada del tractament:_ mentre el Client mantingui actiu el seu pla empresarial, i durant el termini de conservació posterior aplicable als documents i evidències de signatura, conforme a la [Política de Conservació i Custòdia Documental](/legal/document-*retention-*policy).

## 4. Abast dels comptes empresarials

Els comptes empresarials operen sota un sistema de rols diferenciat:

- Els usuaris amb rol de \*administrador\*\* (designats pel Client) poden enviar documents a signar als empleats/col·laboradors de la seva pròpia organització i consultar l'estat d'aquests documents i signatures des d'un panell d'administració.
- Els usuaris amb rol de \*empleat/col·laborador\*\* poden signar els documents que els enviï la seva organització, però no poden utilitzar la Plataforma per a enviar o signar documents amb tercers externs a aquesta organització.

Aquesta segmentació implica que les dades gestionades dins d'un compte empresarial es limiten a l'àmbit intern de l'organització del Client, sense barrejar-se amb l'ús que altres Usuaris (particulars o altres empreses clientes) puguin fer de la Plataforma de manera independent.

## 5. Obligacions de LSigner com a Encarregat del tractament

LSigner es compromet a:

a) Tractar les dades personals únicament seguint les instruccions documentades del Client, incloses les relatives a transferències internacionals, tret que estigui obligat a això pel Dret de la Unió o d'un Estat membre, i en aquest cas informarà el Client d'aquesta exigència legal prèvia, excepte prohibició legal.

b) Garantir que les persones autoritzades per a tractar les dades s'han compromès a respectar la confidencialitat o estan subjectes a una obligació de confidencialitat de naturalesa legal o contractual.

c) Adoptar les mesures de seguretat tècniques i organitzatives descrites en la [Política de Privacitat](/legal/privacy-*policy) i en la Política de Signatura Electrònica, conforme a l'article 32 del RGPD.

d) Respectar les condicions establertes en aquest DPA per a recórrer a un altre encarregat del tractament (subencargado), conforme a la secció 6.

e) Assistir al Client, dins del raonablement possible i tenint en compte la naturalesa del tractament, mitjançant mesures tècniques i organitzatives apropiades, per al compliment de la seva obligació de respondre a les sol·licituds d'exercici de drets dels interessats.

f) Ajudar el Client a garantir el compliment de les obligacions establertes en els articles 32 a 36 del RGPD (seguretat del tractament, notificació de violacions de seguretat, avaluacions d'impacte), tenint en compte la naturalesa del tractament i la informació a la disposició de LSigner.

g) A elecció del Client, suprimir o retornar totes les dades personals una vegada finalitzi la prestació del servei de tractament, i suprimir les còpies existents, tret que el Dret de la Unió o d'un Estat membre exigeixin la seva conservació (per exemple, el termini de conservació d'evidències de signatura amb valor probatori, indicat en la Política de Conservació).

h) Posar a la disposició del Client tota la informació necessària per a demostrar el compliment de les obligacions establertes en l'article 28 del RGPD, i permetre i contribuir a la realització d'auditories, incloses inspeccions, per part del Client o d'un altre auditor autoritzat per aquest, conforme a la secció 8.

i) Informar immediatament el Client si, en la seva opinió, alguna instrucció infringeix el RGPD o altres disposicions de protecció de dades.

## 6. Subencargados del tractament

El Client autoritza de manera general a LSigner a recórrer als següents subencargados per a la prestació del servei, informant-se de qualsevol canvi amb antelació raonable, de manera que el Client pugui oposar-se per motius justificats:

| Subencargado                                        | Funció                                                                                                     | Ubicació                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Hostinger                                           | Allotjament d'infraestructura (base de dades PostgreSQL i còpies de seguretat en S3)                       | França (UE)                                                                |
| Dokploy                                             | Orquestració i desplegament de contenidors sobre la infraestructura anterior                               | França (UE)                                                                |
| Proveïdor de lliurament de correu electrònic (SMTP) | Encaminament i lliurament de correus electrònics, inclosos els que contenen codis OTP generats per LSigner | el Regne Unit (país amb Decisió d'Adequació vigent de la Comissió Europea) |

LSigner garantirà que aquests subencargados assumeixen les mateixes obligacions en matèria de protecció de dades que les establertes en aquest DPA, mitjançant els contractes corresponents, i continuarà sent plenament responsable davant el Client del compliment d'aquestes obligacions per part de les seves subencargados.

## 7. Transferències internacionals

L'única transferència internacional de dades personals fora de l'Espai Econòmic Europeu en el marc d'aquest tractament és la relativa a l'encaminament de correus electrònics a través del proveïdor SMTP amb seu al Regne Unit, país emparat per la Decisió d'Adequació de la Comissió Europea (renovada el 19 de desembre de 2025, vàlida fins a desembre de 2031), per la qual cosa aquesta transferència no requereix garanties addicionals.

## 8. Auditories i inspeccions

El Client podrà sol·licitar a LSigner, amb una antelació raonable i amb una periodicitat raonable, informació i documentació que permeti verificar el compliment de les obligacions establertes en aquest DPA. LSigner podrà proporcionar aquesta informació mitjançant informes d'auditoria propis o de tercers, quan estiguin disponibles, com a alternativa a una auditoria presencial, tret que el Client justifiqui raonablement la necessitat d'aquesta última.

## 9. Notificació de violacions de seguretat

LSigner notificarà al Client, sense dilació indeguda i a tot tardar en el termini de 48 hores des que tingui constància d'això, qualsevol violació de la seguretat de les dades personals tractats en el marc d'aquest DPA que pugui afectar els empleats/col·laboradors del Client, proporcionant la informació raonablement disponible perquè el Client pugui, al seu torn, complir amb les seves obligacions de notificació conforme als articles 33 i 34 del RGPD.

## 10. Destí de les dades a la finalització del contracte

En finalitzar la relació contractual amb el Client (baixa del pla empresarial), LSigner, a elecció del Client, suprimirà o retornarà les dades personals dels empleats/col·laboradors, així com els documents i evidències associades, tret que hagin de conservar-se pel termini indicat en la Política de Conservació i Custòdia Documental per raó del seu valor probatori i de les obligacions legals de conservació documental aplicables.

## 11. Responsabilitat

Cada part serà responsable del compliment de les seves pròpies obligacions conforme al RGPD i a aquest DPA. El Client, com a Responsable del tractament, és responsable de la licitud de les instruccions donades a LSigner i de comptar amb una base legal adequada per al tractament de les dades dels seus empleats/col·laboradors (per exemple, l'execució de la relació laboral o l'interès legítim aplicable).

## 12. Durada

Aquest DPA estarà vigent mentre el Client mantingui actiu un pla empresarial en la Plataforma, i s'extingirà automàticament quan finalitzi aquesta relació contractual, sense perjudici de les obligacions de conservació o supressió de dades que sobrevisquin a la seva finalització conforme a la secció 10.

## 13. Legislació aplicable

Aquest DPA es regeix per la legislació espanyola i pel RGPD, i se sotmet als mateixos Jutjats i Tribunals indicats en els Termes i Condicions del servei.
