# Google Cloud Text-to-Speech Script for Firebot

## Overview
Use Google Cloud's Text-to-Speech service in Firebot to have incredible TTS quality on stream! Choose from any available Google Cloud Platform text-to-speech voice. With controls for Pitch and Speech Rate, you can tailor the voice to whatever you need.

Technically this is a paid service. However, each month Google will give you between 100k to 4M free characters of TTS, in each of six pricing categories (terms *may* vary by region). See their [Text-to-Speech pricing](https://cloud.google.com/text-to-speech/pricing) page for more information. Be advised, the Journey voices are no longer marked as experimental, and will apparantly be getting billed out again.

Looking to recreate the voice of A.D.A (Artificial Directory and Assistant) from Satisfactory? Choose `en-US-Wavenet-C` and adjust the Pitch to `-0.5` and Speed to `0.9` (Note: voice effects were disabled in the most recent update. They should return soon).

## Prerequisites
You must have a Google Cloud Account, and a [Google Cloud API Key](https://cloud.google.com/docs/authentication/api-keys#creating_an_api_key) to use this script. The API Key *may* look something like: `AITEwL55bWmT-zZeuiWF8o9EpruWtue7QUhMy05`. Make sure you have your API Key handy, as you'll need it once you install the Script in [Firebot](https://firebot.app/). 

In addition to obtaining your API Key, you must also activate and enable Google Cloud Text-to-Speech by following this [this link](https://console.cloud.google.com/apis/library/texttospeech.googleapis.com).

## How to use
1. Download the latest **googleCloudTtsRevised.js** file from [Releases](https://github.com/phroggster/firebot-google-cloud-tts/releases)
2. Add the **googleCloudTtsRevised.js** as a startup script in [Firebot](https://firebot.app/) (Settings > Advanced > Startup Scripts).
3. Restart Firebot. A new effect called **Text-to-Speech (Google Cloud)** will have been added.
4. Visit the Integration settings (Settings > Integrations), and *Link* the Google Cloud Platform integration by entering your API Key.
5. Enable the connection to Google Cloud Platform by ensuring the On/Off button in the bottom left is yellow or green.

## History
This is based largely on work done by [Chuck Kostalnick (heyaapl)](https://github.com/heyaapl/firebot-script-google-cloud-tts), and the entire [Crowbar Tools team](https://github.com/crowbartools). Please consider [supporting](https://opencollective.com/crowbartools) them financially, and intellectually contributing to their projects.

This version differs from heyaapl's original with support for all of the Google Cloud TTS voices, additional voice information, support for output to overlay(s), and adjustable output volume control. It also utilizes the integrations system of Firebot to allow for easy enabling or disabling of the connection through a quick-action toggle, without needing to toggle individual events or effects.

## Future
The following list of features are planned to be implemented, and the public release of version 1.0 will be unveiled upon implementation of the majority of this list being checked off (in no particular order):
- [x] All public voices available for use in every supported language.
- [x] Instanced overlay audio output support.
- [ ] Opt-in SSML markup support (almost done).
- [ ] Voice synthesis audio effects (almost done).
- [ ] Variable expansion for voice selection.
  - This will unlock advanced user metadata scenarios, e.g. user A with voice A, user B with voice B, etc.
  - Probably need some form of fallback voice if voice name/language is invalid, but that's all TBD.
- [ ] Friendly auto-update checks (unless Firebot gets this completed first!).
  - Presently inhibited by a lack of ability to make external links clickable.
  - Will likely start out with a notification that can be manually copy+pasted into a browser, or similar.
- [ ] Automated compile-time voice list downloads.
  - I'm presently using the in-tree LibreOffice Spreadsheet file (gtts-voiceslist-converter.ods) to transpose these manually from their static HTML (that iteself doesn't get updated very often!).
- [ ] Better filtering in voice selection UI.
  - Technology, pricing category, gender, language, locale each need unique filters, or *something*.
  - A massive sortable flat list of voices just isn't good enough.
  - Could probably default to only showing the user's locale/lang for a start.
- [ ] Manual ***and*** automated run-time voice list updates.
- [ ] GCloud OAuth integration. 🤢
- [ ] Integrated testing of audio effects and audio encoding/format support for *every* voice.
  - e.g. Journey voices apparantly lost support for MP3/32k encoding out of the blue, and MP3/64k. WTF.
  - Journey also doesn't support synthesis effects nor audio profiles.
- [ ] Translations sure would be nice...
- [ ] OAuth and automated GCloud credential protection updates.
  - [ApiKey RTFM](https://cloud.google.com/docs/authentication/api-keys#api_key_restrictions)
  - ApiKey can be locked down by IP addresses, or by http referer [sic].
  - OAuth can specify authorized origins (http referer [sic]?), and authorized redirects. Both will need to be addressed.

## Disclaimers
The usage of any brand names, service marks, and/or trademarks, properly registered or otherwise, does not imply a recommendation of those brands, products, nor services. This author has **no affiliation** with any brands, companies, marks, products, or services mentioned.

Google® ([78828042](https://tsdr.uspto.gov/#caseNumber=78828042&caseSearchType=US_APPLICATION&caseType=DEFAULT&searchType=statusSearch)) and Google Cloud™℠ ([~~87652070~~](https://tsdr.uspto.gov/#caseNumber=87652070&caseSearchType=US_APPLICATION&caseType=DEFAULT&searchType=statusSearch) *invalidated*) are and were registered marks owned by Google LLC, Delaware, USA.
