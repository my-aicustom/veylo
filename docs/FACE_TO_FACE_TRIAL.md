# Face-to-Face trial: one person playing both sides

Use this script to check the Indonesian ↔ English interpreter before testing with two people. Set your profile listener language to Indonesian. In Face-to-Face, enter **Alex** as the other person and choose **English** as their output language. Use the laptop speaker and microphone you intend to use at the table. If automatic listening captures translated speech, select **Hold to talk** and hold the correct person's button only while that person speaks.

Press **Start interpreter**, allow microphone access, and read one line at a time. Pause after each line until its transcript and translated audio finish. Do not read the translated text aloud.

| Turn | Speaker | Say this aloud | Check the result |
| --- | --- | --- | --- |
| 1 | You, Indonesian | Halo Alex, saya Raka dari Surabaya. Kami menawarkan lima puluh unit lampu industri. | Source is Indonesian; English translation keeps Raka, Surabaya, and 50 units. |
| 2 | Alex, English | Thanks, Raka. What is the price for fifty units? | Source is English; Indonesian translation asks for the price of 50 units. |
| 3 | You, Indonesian | Harganya seratus dua puluh dolar Amerika per unit. Sampel bisa dikirim tanggal delapan Oktober. | English translation keeps USD 120 per unit and 8 October. |
| 4 | Alex, English | Please send one sample first. I will confirm the order after I review it. | Indonesian translation keeps the sample request and conditional commitment. |

Expected for every turn: the original sentence appears in **Live Transcript**, the translation appears beneath it, and translated speech plays when the two languages differ. The speaker label should alternate. If automatic speaker attribution is wrong, select **Force speaker** for the next line; this mode identifies speakers by language, not by voiceprint.

After the four turns, use **Transcript** to export the conversation and **Meeting brief** to check that the price, quantity, sample, and follow-up come only from what you said. Open `/app/diagnostics` to inspect the STT, translation, and TTS timing. A successful local trial is evidence for this browser, microphone, and provider configuration only.
