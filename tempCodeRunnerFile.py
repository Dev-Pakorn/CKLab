
import requests
import json
import base64


url = "https://esapi.ubu.ac.th/api/v1/student/reg-data"


payload = json.dumps({ "loginName": base64.b64encode("68114540353".encode()).decode(),})
headers = { 'Content-Type': 'application/json'}


response = requests.request("POST", url, headers=headers, data=payload)


print(response.json())