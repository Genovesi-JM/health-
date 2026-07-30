from app.config import settings


def test_public_guidance_works_without_auth_or_ai_key(client):
    previous = settings.openai_api_key
    settings.openai_api_key = None
    try:
        response = client.post(
            "/api/v1/chatbot/public-guidance",
            headers={"X-Forwarded-For": "198.51.100.201"},
            json={"message": "How can KAYA help a nurse?", "language": "en"},
        )
        assert response.status_code == 200, response.text
        assert "professional registration" in response.json()["reply"]
    finally:
        settings.openai_api_key = previous


def test_public_guidance_escalates_emergency_in_chinese(client):
    response = client.post(
        "/api/v1/chatbot/public-guidance",
        headers={"X-Forwarded-For": "198.51.100.202"},
        json={"message": "胸痛，呼吸困难", "language": "zh"},
    )
    assert response.status_code == 200
    assert response.json()["action"] == "emergency"
    assert "112" in response.json()["reply"]
