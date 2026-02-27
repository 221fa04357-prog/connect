import whisper
import sys

model = whisper.load_model("base")

audio = sys.argv[1]

result = model.transcribe(audio, fp16=False)

print(result["text"])