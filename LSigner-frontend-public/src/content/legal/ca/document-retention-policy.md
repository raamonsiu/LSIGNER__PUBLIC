# Política de Conservació i Custòdia Documental

_Última actualització:_ Dissabte 4 de juliol de 2026

## 1. Objecte

Aquest document detalla durant quant temps LSigner conserva cada categoria de dades i informació relacionada amb l'ús de la Plataforma, amb quines garanties d'integritat, i què ocorre una vegada transcorreguts aquests terminis. Complementa a la [Política de Privacitat](/legal/privacy-*policy) i a la [Política de Signatura Electrònica](/legal/electronic-*signature-*policy).

## 2. Documents signats i evidències de signatura

Els documents signats, juntament amb la totalitat de les evidències descrites en la Política de Signatura Electrònica (evidència contextual, evidència criptogràfica i payload canònic), es conserven durant _6 anys_ des de la data de la signatura, rebuig o revocació corresponent.

Aquest termini es fixa prenent com a referència l'article 30 del Codi de Comerç, relatiu a l'obligació de conservació de documentació mercantil, amb la finalitat de preservar el valor probatori de la signatura durant un període raonable en el qual pogués plantejar-se una reclamació relacionada amb el document signat.

Durant aquest període, LSigner garanteix la integritat dels documents i evidències mitjançant els mecanismes criptogràfics descrits en la Política de Signatura Electrònica (hash del document, signatura Ed25519 verificable, cadena de custòdia mitjançant `previous_*artifact_aneu`), de manera que qualsevol alteració posterior sigui detectable.

## 3. Esdeveniments d'accés al document

Els esdeveniments d'obertura de documents (`ACCESS_*OPENED`) formen part de la cadena d'evidències d'una operació de signatura i es conserven durant el mateix termini que el document i les evidències de signatura a les quals estan associats (6 anys), atès que aporten context rellevant sobre quan i des d'on es va accedir al document abans de la seva signatura, rebuig o revocació.

## 4. Dades del compte d'usuari

Les dades associades al compte d'un Usuari (nom, correu electrònic, configuració, historial d'activitat no vinculat directament a una signatura concreta) es conserven mentre el compte romangui activa, i durant _12 mesos addicionals_ després de la baixa o cancel·lació del compte, amb la finalitat de permetre la seva possible reactivació i de resoldre disputes pendents relacionades amb el servei.

Transcorregut aquest termini de 12 mesos sense reactivació, les dades del compte s'eliminen o anonimitzen, sense perjudici que els documents i evidències de signatura generats durant la vida del compte continuïn conservant-se pel termini indicat en la secció 2, donat el seu valor probatori independent.

## 5. Codi de verificació OTP

El codi OTP generat per a cada operació de verificació té una naturalesa estrictament efímera: s'elimina automàticament després de la seva validació reeixida o després de la seva expiració (en l'ordre de minuts des de la seva generació). LSigner no conserva el codi OTP en si com a part de l'històric ni de les evidències; el que es conserva és el \*resultat\*\* d'aquesta verificació (mètode utilitzat i referència emmascarada del canal), conforme al descrit en la Política de Signatura Electrònica.

## 6. Logs tècnics i de seguretat generals

Els registres tècnics i de seguretat no vinculats directament a una operació de signatura concreta (per exemple, registres d'accés a la infraestructura, intents fallits d'autenticació) es conserven durant _12 mesos_, termini raonable per a la detecció i anàlisi d'incidents de seguretat, transcorregut el qual s'eliminen de manera automàtica.

## 7. Analítica pròpia agregada

El sistema d'analítica intern i autoallotjat de LSigner processa l'adreça IP de cada sol·licitud de manera \*efímera\*\*, únicament per al càlcul d'estadístiques agregades d'ús de la Plataforma. Una vegada computat la dada agregada corresponent, l'adreça IP individual no es conserva ni s'emmagatzema de manera històrica o individualitzada.

## 8. Còpies de seguretat (còpies de seguretat)

Les còpies de seguretat de la base de dades (emmagatzemats en un contenidor S3 sobre la mateixa infraestructura de Hostinger a França) es mantenen sota un cicle de rotació continu, amb la fi exclusiva de garantir la recuperació del servei davant incidents tècnics. Les còpies de seguretat estan subjectes a les mateixes mesures de seguretat que les dades en producció, i les dades eliminades dels sistemes de producció conforme als terminis anteriors s'eliminen també de les còpies de seguretat a mesura que aquestes es giren, sense que es generin còpies de seguretat indefinides o de conservació permanent.

## 9. Sol·licituds de supressió (dret a l'oblit) i el seu límit

Quan un Usuari sol·licita l'eliminació de les seves dades personals conforme al seu dret de supressió, LSigner atendrà aquesta sol·licitud respecte de les dades de compte i qualsevol dada no subjecta a una obligació legal de conservació. No obstant això, conforme a l'article 17.3.b) del RGPD, _no serà possible eliminar els documents signats ni les evidències de signatura abans que transcorri el termini de conservació indicat en la secció 2_, atès que aquesta conservació respon a una obligació legal i a la necessitat de preservar el valor probatori de la signatura enfront de tercers, inclòs el propi Usuari que la va sol·licitar.

## 10. Conservació extraordinària per litigi o requeriment

En cas que un document, evidència o dada estigui relacionat amb un litigi, procediment judicial o requeriment d'una autoritat competent en curs, LSigner podrà conservar aquesta informació més enllà dels terminis generals indicats en aquest document, durant el temps estrictament necessari per a donar compliment a aquest procediment o requeriment.

## 11. Eliminació o anonimització en finalitzar els terminis

Transcorreguts els terminis de conservació indicats en aquest document, les dades corresponents s'eliminen de manera definitiva o s'anonimitzen de manera irreversible, de manera que no sigui possible tornar a associar-los a una persona identificada o identificable.

## 12. Revisió d'aquesta Política

LSigner podrà revisar els terminis de conservació indicats en aquest document per a adaptar-los a canvis normatius, jurisprudencials o de la pròpia infraestructura tècnica del servei. Qualsevol canvi rellevant es reflectirà actualitzant la data de "última actualització" a l'inici d'aquest document.
