# Google Cloud Text-to-Speech Script for Firebot

## Overview
Use Google Cloud's Text-to-Speech service in Firebot to have incredible TTS quality on stream! Choose from any available Google Cloud Platform text-to-speech voice. With controls for Pitch and Speech Rate, you can tailor the voice to whatever you need.

Technically this is a paid service. However, each month Google will give you 1,000,000 free characters of TTS, in each of three pricing categories, up to a total of three million characters before any charges (terms *may* vary by region). See their [Text-to-Speech pricing](https://cloud.google.com/text-to-speech/pricing) page for more information. Be advised, the following note exists on the pricing page at time of writing:
> Journey voices are experimental and are currently not billed.

Looking to recreate the voice of A.D.A (Artificial Directory and Assistant) from Satisfactory? Choose `en-US-Wavenet-C` and adjust the Pitch to `-0.5` and Speed to `0.9`.

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
This is based largely on work done by [Chuck Kostalnick (heyaapl)](https://github.com/heyaapl/firebot-script-google-cloud-tts), and the entire [Crowbar Tools team](https://github.com/crowbartools). Please consider [supporting](https://opencollective.com/crowbartools) them, or contributing to their projects.

This version differs from heyaapl's original with support for all of the Google Cloud TTS voices, additional voice information, support for output to overlay(s), and adjustable output volume control. It also utilizes the integrations system of Firebot to allow for easy enabling or disabling of the connection through a quick-action toggle, without needing to toggle individual events or effects.
